import { INestApplication, Logger } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { App } from 'supertest/types';

import { createTestApp } from './support/app';
import { truncateAll } from './support/db';
import { createHierarchy, createRole, grant } from './support/fixtures';
import { bearer, loginToken } from './support/http';

const STAFF = ['admin1', 'admin2', 'head1', 'head2', 'member1', 'member2', 'member3'];

/**
 * The full hierarchy (see createHierarchy): owner → admin1 → head1 (Finance: Payables = member1,
 * member2); owner → admin2; owner → head2 (HR: Hiring = member3). Every staff user holds a role with
 * every permission, so only the level and scope rules decide.
 */
describe('Organisation hierarchy (e2e)', () => {
  let app: INestApplication<App>;
  let sequelize: Sequelize;
  let h: Record<string, string>;
  let staffRoleId: string;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string, method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    http()
      [method](`/api/v1/${url}`)
      .set(...bearer(tokens[who]));
  const nameOf = (id: string): string => Object.entries(h).find(([, v]) => v === id)?.[0] ?? id;
  const userNames = async (who: string): Promise<string[]> => {
    const res = await as(who, 'get', 'users?pageSize=100').expect(200);
    return (res.body.data as { id: string }[]).map((u) => nameOf(u.id)).sort();
  };
  const newUser = (email: string, extra: object = {}) => ({
    email,
    firstName: 'New',
    lastName: 'Person',
    roleIds: [staffRoleId],
    ...extra,
  });

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    ({ app, sequelize } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    h = await createHierarchy(sequelize);
    staffRoleId = await createRole(sequelize, { code: 'staff', organizationId: h.org });
    const codes = await sequelize.query<{ code: string }>('SELECT code FROM permissions', {
      type: QueryTypes.SELECT,
    });
    await grant(
      sequelize,
      staffRoleId,
      codes.map((c) => c.code),
    );
    for (const who of STAFF) {
      await sequelize.query('INSERT INTO user_roles (user_id, role_id) VALUES (:userId, :roleId)', {
        replacements: { userId: h[who], roleId: staffRoleId },
      });
    }
    for (const who of ['owner', ...STAFF]) {
      tokens[who] = await loginToken(app, `${who}@h.example.com`);
    }
  });

  afterAll(() => app.close());

  describe('levels', () => {
    it('should report the level on the session and on users', async () => {
      expect((await as('owner', 'get', 'auth/me').expect(200)).body.data.level).toBe('owner');
      const head = await as('owner', 'get', `users/${h.head1}`).expect(200);
      expect(head.body.data).toMatchObject({
        level: 'department_head',
        teams: [],
        isOwner: false,
      });
      const member = await as('owner', 'get', `users/${h.member1}`).expect(200);
      expect(member.body.data.teams).toEqual([{ id: h.payables, name: 'Payables' }]);
    });

    it('should let an admin create a department head but not an admin, and a member nobody', async () => {
      const created = await as('admin1', 'post', 'users')
        .send(newUser('dh@h.example.com', { level: 'department_head' }))
        .expect(201);
      expect(created.body.data.user.level).toBe('department_head');

      const admin = await as('admin1', 'post', 'users')
        .send(newUser('a3@h.example.com', { level: 'admin' }))
        .expect(403);
      expect(admin.body.error.code).toBe('FORBIDDEN_OPERATION');
      const byMember = await as('member1', 'post', 'users')
        .send(newUser('m9@h.example.com'))
        .expect(403);
      expect(byMember.body.error.code).toBe('FORBIDDEN_OPERATION');
      await as('owner', 'post', 'users')
        .send(newUser('o9@h.example.com', { level: 'owner' }))
        .expect(422);
    });

    it('should change a level only within the caller rights', async () => {
      const promoted = await as('admin1', 'patch', `users/${h.member1}`)
        .send({ level: 'department_head' })
        .expect(200);
      expect(promoted.body.data.level).toBe('department_head');
      const refused = await as('admin1', 'patch', `users/${h.admin2}`)
        .send({ level: 'member' })
        .expect(403);
      expect(refused.body.error.code).toBe('FORBIDDEN_OPERATION');
    });
  });

  describe('who sees whom', () => {
    it('should show the owner everyone', async () => {
      expect(await userNames('owner')).toEqual(['owner', ...STAFF].sort());
    });

    it("should show admins each other's people but not the owner's direct branch", async () => {
      expect(await userNames('admin2')).toEqual([
        'admin1',
        'admin2',
        'head1',
        'member1',
        'member2',
        'owner',
      ]);
      const hidden = await as('admin2', 'get', `users/${h.head2}`).expect(404);
      expect(hidden.body.error.code).toBe('NOT_FOUND');
    });

    it("should show a head their departments' people and a member their teammates", async () => {
      expect(await userNames('head1')).toEqual(['head1', 'member1', 'member2']);
      expect(await userNames('member1')).toEqual(['member1', 'member2']);
      await as('member1', 'get', `users/${h.member3}`).expect(404);
    });
  });

  describe('departments', () => {
    it('should create with a head, and list by scope', async () => {
      const created = await as('owner', 'post', 'departments')
        .send({ name: 'Sales', headUserId: h.head2 })
        .expect(201);
      expect(created.body.data).toMatchObject({
        name: 'Sales',
        head: { id: h.head2, email: 'head2@h.example.com' },
        teamCount: 0,
        memberCount: 0,
      });

      const all = await as('admin1', 'get', 'departments').expect(200);
      expect(all.body.data.map((d: { name: string }) => d.name)).toEqual([
        'Finance',
        'HR',
        'Sales',
      ]);
      expect(all.body.meta).toMatchObject({ page: 1, total: 3 });
      const own = await as('head1', 'get', 'departments').expect(200);
      expect(own.body.data.map((d: { name: string }) => d.name)).toEqual(['Finance']);
      expect(own.body.data[0]).toMatchObject({ teamCount: 1, memberCount: 2 });
    });

    it('should refuse non-admins, a member as head, duplicate names and deactivating with teams', async () => {
      expect(
        (await as('head1', 'post', 'departments').send({ name: 'Ops' }).expect(403)).body.error
          .code,
      ).toBe('FORBIDDEN_OPERATION');
      const notHead = await as('owner', 'post', 'departments')
        .send({ name: 'Ops', headUserId: h.member1 })
        .expect(422);
      expect(notHead.body.error.details[0].field).toBe('headUserId');
      expect(
        (await as('owner', 'post', 'departments').send({ name: 'finance' }).expect(409)).body.error
          .code,
      ).toBe('DEPARTMENT_NAME_CONFLICT');
      expect(
        (await as('owner', 'delete', `departments/${h.finance}`).expect(409)).body.error.code,
      ).toBe('DEPARTMENT_HAS_TEAMS');
    });

    it('should rename, clear the head and deactivate an empty department', async () => {
      const created = await as('admin1', 'post', 'departments').send({ name: 'Ops' }).expect(201);
      const id = created.body.data.id as string;

      const renamed = await as('admin1', 'patch', `departments/${id}`)
        .send({ name: 'Operations', headUserId: null })
        .expect(200);
      expect(renamed.body.data).toMatchObject({ name: 'Operations', head: null });
      expect((await as('admin1', 'delete', `departments/${id}`).expect(200)).body.data).toBeNull();
      await as('admin1', 'patch', `departments/${id}`).send({ name: 'Again' }).expect(404);
    });
  });

  describe('teams', () => {
    it('should let a head create teams only in departments they head', async () => {
      const created = await as('head1', 'post', 'teams')
        .send({ departmentId: h.finance, name: 'Receivables' })
        .expect(201);
      expect(created.body.data).toMatchObject({
        name: 'Receivables',
        department: { id: h.finance, name: 'Finance' },
        members: [],
      });
      const other = await as('head1', 'post', 'teams')
        .send({ departmentId: h.hr, name: 'Payroll' })
        .expect(403);
      expect(other.body.error.code).toBe('FORBIDDEN_OPERATION');
      expect(
        (
          await as('head1', 'post', 'teams')
            .send({ departmentId: h.finance, name: 'payables' })
            .expect(409)
        ).body.error.code,
      ).toBe('TEAM_NAME_CONFLICT');
    });

    it('should put a member in two teams and list teams by scope', async () => {
      const added = await as('owner', 'post', `teams/${h.hiring}/members`)
        .send({ userId: h.member1 })
        .expect(201);
      expect(added.body.data.members.map((m: { id: string }) => nameOf(m.id))).toEqual(
        ['member1', 'member3'].sort(),
      );
      await as('owner', 'post', `teams/${h.hiring}/members`)
        .send({ userId: h.member1 })
        .expect(201);

      const mine = await as('member1', 'get', 'teams').expect(200);
      expect(mine.body.data.map((t: { name: string }) => t.name)).toEqual(['Hiring', 'Payables']);
      const user = await as('owner', 'get', `users/${h.member1}`).expect(200);
      expect(user.body.data.teams.map((t: { name: string }) => t.name)).toEqual([
        'Hiring',
        'Payables',
      ]);
      const byDepartment = await as('owner', 'get', `teams?departmentId=${h.hr}`).expect(200);
      expect(byDepartment.body.data.map((t: { name: string }) => t.name)).toEqual(['Hiring']);
    });

    it('should refuse unseen or owner members, deleting a team with members, and remove members', async () => {
      const unseen = await as('head2', 'post', `teams/${h.hiring}/members`)
        .send({ userId: h.member1 })
        .expect(422);
      expect(unseen.body.error.details[0].field).toBe('userId');
      await as('owner', 'post', `teams/${h.hiring}/members`).send({ userId: h.owner }).expect(422);
      expect((await as('head1', 'delete', `teams/${h.payables}`).expect(409)).body.error.code).toBe(
        'TEAM_HAS_MEMBERS',
      );

      await as('head1', 'delete', `teams/${h.payables}/members/${h.member1}`).expect(200);
      const left = await as('head1', 'delete', `teams/${h.payables}/members/${h.member2}`).expect(
        200,
      );
      expect(left.body.data.members).toEqual([]);
      const renamed = await as('head1', 'patch', `teams/${h.payables}`)
        .send({ name: 'AP' })
        .expect(200);
      expect(renamed.body.data.name).toBe('AP');
      await as('head1', 'delete', `teams/${h.payables}`).expect(200);
      await as('head1', 'delete', `teams/${h.payables}`).expect(404);
    });

    it("should let a head create a member straight into their department's team", async () => {
      const created = await as('head1', 'post', 'users')
        .send(newUser('fresh@h.example.com', { teamIds: [h.payables] }))
        .expect(201);
      const id = created.body.data.user.id as string;
      expect(created.body.data.user.teams).toEqual([{ id: h.payables, name: 'Payables' }]);
      await as('head1', 'get', `users/${id}`).expect(200);

      const foreign = await as('head1', 'post', 'users')
        .send(newUser('other@h.example.com', { teamIds: [h.hiring] }))
        .expect(422);
      expect(foreign.body.error.details[0].field).toBe('teamIds');
    });
  });
});
