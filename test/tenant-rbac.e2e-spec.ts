import { INestApplication, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { App } from 'supertest/types';

import { createTestApp } from './support/app';
import { truncateAll } from './support/db';
import { PASSWORD, createOrganization, createRole, createUser, grant } from './support/fixtures';
import { bearer, loginToken } from './support/http';

interface RoleBody {
  id: string;
  code: string;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

describe('Tenant RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let sequelize: Sequelize;
  let orgId: string;
  let ownerId: string;
  let ownerRoleId: string;
  let owner: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string, method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    http()
      [method](url)
      .set(...bearer(token));
  const createRoleApi = (token: string, body: object) =>
    as(token, 'post', '/api/v1/roles').send(body);
  /** A staff user holding a fresh role with exactly these codes. */
  const staffWith = async (
    email: string,
    codes: string[],
    level: 'admin' | 'member' = 'member',
  ): Promise<{ id: string; token: string; roleId: string }> => {
    const roleId = await createRole(sequelize, {
      code: `r_${email.split('@')[0]}`,
      organizationId: orgId,
    });
    await grant(sequelize, roleId, codes);
    const id = await createUser(sequelize, {
      email,
      organizationId: orgId,
      roleIds: [roleId],
      level,
    });
    return { id, token: await loginToken(app, email), roleId };
  };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    ({ app, sequelize } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    orgId = await createOrganization(sequelize, { name: 'Skyline', slug: 'skyline' });
    ownerRoleId = await createRole(sequelize, {
      code: 'developer_super_user',
      organizationId: orgId,
      isSystemRole: true,
    });
    ownerId = await createUser(sequelize, {
      email: 'owner@skyline.example.com',
      organizationId: orgId,
      roleIds: [ownerRoleId],
    });
    owner = await loginToken(app, 'owner@skyline.example.com');
  });

  afterAll(() => app.close());

  describe('permission catalogue', () => {
    it('should give the owner all 26 codes and return the matrix', async () => {
      const me = await as(owner, 'get', '/api/v1/auth/me').expect(200);
      expect(me.body.data.permissions).toHaveLength(26);

      const res = await as(owner, 'get', '/api/v1/permissions').expect(200);

      expect(res.body.data.map((m: { module: string }) => m.module)).toEqual([
        'users',
        'roles',
        'departments',
        'teams',
        'projects',
        'units',
        'branding',
      ]);
      expect(res.body.data[0].actions[0]).toEqual({
        action: 'view',
        label: 'View users',
        code: 'users.view',
      });
    });

    it('should refuse users without roles.view and platform users', async () => {
      const { token } = await staffWith('viewer@skyline.example.com', ['users.view']);
      await createUser(sequelize, { email: 'ops@invespy.example.com' });

      expect((await as(token, 'get', '/api/v1/permissions').expect(403)).body.error.code).toBe(
        'PERMISSION_DENIED',
      );
      await as(await loginToken(app, 'ops@invespy.example.com'), 'get', '/api/v1/roles').expect(
        403,
      );
    });

    it('should give a user the union of their roles and apply grant changes on the next request', async () => {
      const a = await createRole(sequelize, { code: 'a', organizationId: orgId });
      const b = await createRole(sequelize, { code: 'b', organizationId: orgId });
      await grant(sequelize, a, ['users.view']);
      await grant(sequelize, b, ['projects.view']);
      await createUser(sequelize, {
        email: 'u@skyline.example.com',
        organizationId: orgId,
        roleIds: [a, b],
      });
      const token = await loginToken(app, 'u@skyline.example.com');

      expect((await as(token, 'get', '/api/v1/auth/me').expect(200)).body.data.permissions).toEqual(
        ['projects.view', 'users.view'],
      );
      await as(token, 'get', '/api/v1/users').expect(200);

      await as(owner, 'patch', `/api/v1/roles/${a}`).send({ permissions: [] }).expect(200);

      await as(token, 'get', '/api/v1/users').expect(403);
    });
  });

  describe('roles', () => {
    it('should create a role, list it after the built-in one, and reject duplicates', async () => {
      const created = await createRoleApi(owner, {
        name: 'HR Assistant',
        permissions: ['users.view', 'users.create'],
      }).expect(201);

      expect(created.body.data).toMatchObject({
        name: 'HR Assistant',
        code: 'hr_assistant',
        description: null,
        isSystem: false,
        permissions: ['users.create', 'users.view'],
        userCount: 0,
      });
      const list = await as(owner, 'get', '/api/v1/roles').expect(200);
      expect(list.body.data.map((r: RoleBody) => [r.code, r.isSystem])).toEqual([
        ['developer_super_user', true],
        ['hr_assistant', false],
      ]);
      expect(list.body.data[0].permissions).toHaveLength(26);
      const dup = await createRoleApi(owner, { name: 'hr assistant', permissions: [] }).expect(409);
      expect(dup.body.error.code).toBe('ROLE_NAME_CONFLICT');
    });

    it('should validate names and permission codes', async () => {
      const bad = await createRoleApi(owner, { name: 'A', permissions: ['nope.view'] }).expect(422);
      expect(bad.body.error.details.map((d: { field: string }) => d.field)).toEqual(['name']);
      const unknown = await createRoleApi(owner, {
        name: 'Valid',
        permissions: ['nope.view'],
      }).expect(422);
      expect(unknown.body.error.details).toEqual([
        { field: 'permissions', messages: ['Unknown permission(s): nope.view.'] },
      ]);
    });

    it('should stop escalation when creating and editing roles', async () => {
      const { token } = await staffWith('lead@skyline.example.com', [
        'roles.view',
        'roles.create',
        'roles.edit',
        'users.view',
      ]);
      const stronger = await createRoleApi(owner, {
        name: 'Manager',
        permissions: ['users.edit'],
      }).expect(201);

      expect(
        (await createRoleApi(token, { name: 'Sneaky', permissions: ['users.edit'] }).expect(403))
          .body.error.code,
      ).toBe('PERMISSION_ESCALATION');
      await createRoleApi(token, { name: 'Fine', permissions: ['users.view'] }).expect(201);
      expect(
        (
          await as(token, 'patch', `/api/v1/roles/${stronger.body.data.id}`)
            .send({ name: 'Renamed' })
            .expect(403)
        ).body.error.code,
      ).toBe('PERMISSION_ESCALATION');
    });

    it('should rename and regrant, and protect the built-in role', async () => {
      const role = await createRoleApi(owner, {
        name: 'Sales',
        permissions: ['users.view'],
      }).expect(201);

      const updated = await as(owner, 'patch', `/api/v1/roles/${role.body.data.id}`)
        .send({ name: 'Sales Team', description: 'Front office', permissions: ['projects.view'] })
        .expect(200);

      expect(updated.body.data).toMatchObject({
        code: 'sales_team',
        description: 'Front office',
        permissions: ['projects.view'],
      });
      const system = await as(owner, 'patch', `/api/v1/roles/${ownerRoleId}`)
        .send({ name: 'X Y' })
        .expect(403);
      expect(system.body.error.code).toBe('SYSTEM_ROLE_PROTECTED');
      expect(
        (await as(owner, 'delete', `/api/v1/roles/${ownerRoleId}`).expect(403)).body.error.code,
      ).toBe('SYSTEM_ROLE_PROTECTED');
    });

    it('should deactivate an unused role and refuse one in use', async () => {
      const unused = await createRoleApi(owner, { name: 'Unused', permissions: [] }).expect(201);
      const used = await createRoleApi(owner, { name: 'Used', permissions: ['users.view'] }).expect(
        201,
      );
      await as(owner, 'post', '/api/v1/users')
        .send({
          email: 'a@skyline.example.com',
          firstName: 'A',
          lastName: 'B',
          roleIds: [used.body.data.id],
        })
        .expect(201);
      await as(owner, 'post', '/api/v1/users')
        .send({
          email: 'c@skyline.example.com',
          firstName: 'C',
          lastName: 'D',
          roleIds: [used.body.data.id],
        })
        .expect(201);

      const deleted = await as(owner, 'delete', `/api/v1/roles/${unused.body.data.id}`).expect(200);
      expect(deleted.body).toEqual({ success: true, data: null });
      const list = await as(owner, 'get', '/api/v1/roles').expect(200);
      expect(list.body.data.map((r: RoleBody) => r.code)).not.toContain('unused');

      const inUse = await as(owner, 'delete', `/api/v1/roles/${used.body.data.id}`).expect(409);
      expect(inUse.body.error).toEqual({
        code: 'ROLE_IN_USE',
        message: 'This role is assigned to 2 users; reassign them first.',
      });
      await createRoleApi(owner, { name: 'Unused', permissions: [] }).expect(201);
    });

    it("should hide another company's roles", async () => {
      const other = await createOrganization(sequelize);
      const foreign = await createRole(sequelize, { code: 'foreign', organizationId: other });

      await as(owner, 'patch', `/api/v1/roles/${foreign}`).send({ name: 'Mine now' }).expect(404);
      expect((await as(owner, 'get', '/api/v1/roles').expect(200)).body.data).toHaveLength(1);
    });
  });

  describe('users', () => {
    let hrRole: string;

    beforeEach(async () => {
      hrRole = (
        await createRoleApi(owner, {
          name: 'HR Assistant',
          permissions: ['users.view', 'users.create'],
        }).expect(201)
      ).body.data.id;
    });

    it('should create a user who must reset and carries the role permissions', async () => {
      const res = await as(owner, 'post', '/api/v1/users')
        .send({
          email: 'Hira@Skyline.example.com',
          firstName: 'Hira',
          lastName: 'Shah',
          roleIds: [hrRole],
        })
        .expect(201);

      expect(res.body.data.user).toMatchObject({
        email: 'hira@skyline.example.com',
        status: 'active',
        isOwner: false,
        roles: [{ id: hrRole, name: 'HR Assistant', code: 'hr_assistant' }],
        permissions: ['users.create', 'users.view'],
        lastLoginAt: null,
      });
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'hira@skyline.example.com', password: res.body.data.temporaryPassword })
        .expect(200);
      expect(login.body.data.user).toMatchObject({
        mustResetPassword: true,
        permissions: ['users.create', 'users.view'],
      });
    });

    it('should validate roles and the email', async () => {
      const noRoles = await as(owner, 'post', '/api/v1/users')
        .send({ email: 'x@y.co', firstName: 'X', lastName: 'Y', roleIds: [] })
        .expect(422);
      expect(noRoles.body.error.details.map((d: { field: string }) => d.field)).toEqual([
        'roleIds',
      ]);
      const ghost = await as(owner, 'post', '/api/v1/users')
        .send({
          email: 'x@y.co',
          firstName: 'X',
          lastName: 'Y',
          roleIds: ['0192f3a4-0000-7000-8000-000000000000'],
        })
        .expect(422);
      expect(ghost.body.error.details).toEqual([
        { field: 'roleIds', messages: ['One or more roles do not exist.'] },
      ]);
      const system = await as(owner, 'post', '/api/v1/users')
        .send({ email: 'x@y.co', firstName: 'X', lastName: 'Y', roleIds: [ownerRoleId] })
        .expect(403);
      expect(system.body.error.code).toBe('SYSTEM_ROLE_PROTECTED');
      const dup = await as(owner, 'post', '/api/v1/users')
        .send({
          email: 'owner@skyline.example.com',
          firstName: 'X',
          lastName: 'Y',
          roleIds: [hrRole],
        })
        .expect(409);
      expect(dup.body.error.code).toBe('EMAIL_CONFLICT');
    });

    it('should list users oldest first with search and status, and hide other companies', async () => {
      const other = await createOrganization(sequelize);
      const outsider = await createUser(sequelize, {
        email: 'x@other.example.com',
        organizationId: other,
      });
      await createUser(sequelize, {
        email: 'gone@skyline.example.com',
        organizationId: orgId,
        status: 'inactive',
      });

      const list = await as(owner, 'get', '/api/v1/users?page=1&pageSize=20').expect(200);
      expect(
        list.body.data.map((u: { email: string; isOwner: boolean }) => [u.email, u.isOwner]),
      ).toEqual([
        ['owner@skyline.example.com', true],
        ['gone@skyline.example.com', false],
      ]);
      expect(
        (await as(owner, 'get', '/api/v1/users?status=inactive').expect(200)).body.meta.total,
      ).toBe(1);
      expect(
        (await as(owner, 'get', '/api/v1/users?search=GONE').expect(200)).body.meta.total,
      ).toBe(1);
      await as(owner, 'get', `/api/v1/users/${outsider}`).expect(404);
      await as(owner, 'get', `/api/v1/users/${ownerId}`).expect(200);
    });

    it('should edit names and roles, and refuse changing your own roles', async () => {
      const created = await as(owner, 'post', '/api/v1/users')
        .send({
          email: 'hira@skyline.example.com',
          firstName: 'Hira',
          lastName: 'Shah',
          roleIds: [hrRole],
        })
        .expect(201);
      const viewer = (
        await createRoleApi(owner, { name: 'Viewer', permissions: ['projects.view'] }).expect(201)
      ).body.data.id as string;

      const updated = await as(owner, 'patch', `/api/v1/users/${created.body.data.user.id}`)
        .send({ firstName: 'Hira B', roleIds: [viewer] })
        .expect(200);

      expect(updated.body.data).toMatchObject({
        firstName: 'Hira B',
        permissions: ['projects.view'],
      });
      const self = await as(owner, 'patch', `/api/v1/users/${ownerId}`)
        .send({ roleIds: [viewer] })
        .expect(403);
      expect(self.body.error.code).toBe('FORBIDDEN_OPERATION');
    });

    it('should protect the owner and users stronger than the caller', async () => {
      // Admins see the owner and other admins, so the safeguards (not visibility) answer here.
      const manager = await staffWith(
        'mgr@skyline.example.com',
        ['users.view', 'users.edit', 'users.deactivate'],
        'admin',
      );
      const stronger = await staffWith(
        'strong@skyline.example.com',
        ['users.view', 'roles.edit'],
        'admin',
      );

      const toOwner = await as(manager.token, 'post', `/api/v1/users/${ownerId}/deactivate`).expect(
        403,
      );
      expect(toOwner.body.error).toEqual({
        code: 'FORBIDDEN_OPERATION',
        message: 'The company owner cannot be changed here.',
      });
      const toStronger = await as(manager.token, 'patch', `/api/v1/users/${stronger.id}`)
        .send({ firstName: 'Z' })
        .expect(403);
      expect(toStronger.body.error.code).toBe('PERMISSION_ESCALATION');
    });

    it('should deactivate (ending sessions and access), reactivate, and refuse self-deactivation', async () => {
      const staff = await staffWith('staff@skyline.example.com', ['projects.view']);
      const session = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'staff@skyline.example.com', password: PASSWORD })
        .expect(200);

      const res = await as(owner, 'post', `/api/v1/users/${staff.id}/deactivate`).expect(200);

      expect(res.body.data.status).toBe('inactive');
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.body.data.refreshToken })
        .expect(401);
      expect(
        (
          await http()
            .post('/api/v1/auth/login')
            .send({ email: 'staff@skyline.example.com', password: PASSWORD })
            .expect(403)
        ).body.error.code,
      ).toBe('ACCOUNT_INACTIVE');
      await as(owner, 'post', `/api/v1/users/${staff.id}/activate`).expect(200);
      await loginToken(app, 'staff@skyline.example.com');
      const self = await as(owner, 'post', `/api/v1/users/${ownerId}/deactivate`).expect(403);
      expect(self.body.error.code).toBe('FORBIDDEN_OPERATION');
    });

    it("should reset a user's password and refuse resetting your own here", async () => {
      const staff = await staffWith('staff@skyline.example.com', ['projects.view']);

      const res = await as(owner, 'post', `/api/v1/users/${staff.id}/reset-password`).expect(200);

      expect(res.body.data.temporaryPassword).toMatch(/^Tmp-/);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'staff@skyline.example.com', password: PASSWORD })
        .expect(401);
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'staff@skyline.example.com', password: res.body.data.temporaryPassword })
        .expect(200);
      expect(login.body.data.user.mustResetPassword).toBe(true);
      expect(
        (await as(owner, 'post', `/api/v1/users/${ownerId}/reset-password`).expect(403)).body.error
          .code,
      ).toBe('FORBIDDEN_OPERATION');
    });
  });
});
