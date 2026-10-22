import { INestApplication, Logger } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { App } from 'supertest/types';

import { seedPlatformIdentity } from '../seeds/platform-identity.seed';
import { createTestApp } from './support/app';
import { truncateAll } from './support/db';
import { PASSWORD, createOrganization, createUser } from './support/fixtures';
import { bearer, loginToken } from './support/http';

interface Developer {
  id: string;
  status: string;
  userCount: number;
  superUser: { email: string; name: string } | null;
}

describe('Platform console (e2e)', () => {
  let app: INestApplication<App>;
  let sequelize: Sequelize;
  let superToken: string;

  const http = () => request(app.getHttpServer());
  const asSuper = (method: 'get' | 'post', url: string) =>
    http()
      [method](url)
      .set(...bearer(superToken));
  const onboard = (body: object) => asSuper('post', '/api/v1/platform/developers').send(body);
  const palm = {
    name: 'Palm Estates',
    slug: 'palm-estates',
    superUser: { email: 'owner@palm.example.com', firstName: 'Sara', lastName: 'Khan' },
  };
  const outboxLink = async (to: string): Promise<string> => {
    const rows = await sequelize.query<{ body: string }>(
      'SELECT body FROM mail_outbox WHERE to_email = :to ORDER BY created_at DESC LIMIT 1',
      { replacements: { to }, type: QueryTypes.SELECT },
    );
    return /accept-invite\/(\S+)/.exec(rows[0].body)![1];
  };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    ({ app, sequelize } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    await seedPlatformIdentity(sequelize, {
      email: 'platform@example.com',
      password: PASSWORD,
      firstName: 'Ops',
      lastName: 'Lead',
    });
    superToken = await loginToken(app, 'platform@example.com');
  });

  afterAll(() => app.close());

  describe('access', () => {
    it('should refuse tenant users with 403 PERMISSION_DENIED and anonymous callers with 401', async () => {
      const org = await createOrganization(sequelize);
      await createUser(sequelize, { email: 'tenant@example.com', organizationId: org });
      const tenantToken = await loginToken(app, 'tenant@example.com');

      const res = await http()
        .get('/api/v1/platform/developers')
        .set(...bearer(tenantToken))
        .expect(403);

      expect(res.body.error.code).toBe('PERMISSION_DENIED');
      await http().get('/api/v1/platform/developers').expect(401);
    });
  });

  describe('developers', () => {
    it('should onboard a company whose owner logs in with the temporary password and must reset', async () => {
      const res = await onboard(palm).expect(201);

      expect(res.body.data).toEqual({
        developer: {
          id: expect.any(String),
          name: 'Palm Estates',
          slug: 'palm-estates',
          status: 'active',
          createdAt: expect.any(String),
          userCount: 1,
          superUser: { id: expect.any(String), email: 'owner@palm.example.com', name: 'Sara Khan' },
        },
        superUser: { id: expect.any(String), email: 'owner@palm.example.com' },
        temporaryPassword: expect.stringMatching(/^Tmp-/),
      });
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'owner@palm.example.com', password: res.body.data.temporaryPassword })
        .expect(200);
      expect(login.body.data.user).toMatchObject({
        plane: 'tenant',
        roles: ['developer_super_user'],
        isSuperUser: true,
        mustResetPassword: true,
      });
    });

    it('should report every bad field at once with dot paths', async () => {
      const res = await onboard({
        name: '',
        slug: 'Bad Slug',
        superUser: { email: 'nope', firstName: '', lastName: 'K' },
      }).expect(422);

      expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(
        ['name', 'slug', 'superUser.email', 'superUser.firstName'].sort(),
      );
    });

    it('should answer SLUG_RESERVED, SLUG_CONFLICT and EMAIL_CONFLICT', async () => {
      await onboard(palm).expect(201);

      expect((await onboard({ ...palm, slug: 'admin' }).expect(422)).body.error.code).toBe(
        'SLUG_RESERVED',
      );
      expect(
        (await onboard({ ...palm, superUser: { ...palm.superUser, email: 'x@y.co' } }).expect(409))
          .body.error.code,
      ).toBe('SLUG_CONFLICT');
      expect((await onboard({ ...palm, slug: 'other' }).expect(409)).body.error.code).toBe(
        'EMAIL_CONFLICT',
      );
    });

    it('should list newest first with search and status filters, and show detail', async () => {
      const a = (await onboard(palm).expect(201)).body.data.developer as Developer;
      await onboard({
        name: 'Skyline',
        slug: 'skyline',
        superUser: { email: 'o@sky.example.com', firstName: 'Ali', lastName: 'Raza' },
      }).expect(201);

      const all = await asSuper('get', '/api/v1/platform/developers?page=1&pageSize=20').expect(
        200,
      );
      expect(all.body.data.map((d: Developer) => d.superUser?.email)).toEqual([
        'o@sky.example.com',
        'owner@palm.example.com',
      ]);
      expect(all.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });

      const found = await asSuper('get', '/api/v1/platform/developers?search=khan').expect(200);
      expect(found.body.data.map((d: Developer) => d.id)).toEqual([a.id]);

      await asSuper('get', `/api/v1/platform/developers/${a.id}`).expect(200);
      await asSuper(
        'get',
        '/api/v1/platform/developers/0192f3a4-0000-7000-8000-000000000000',
      ).expect(404);
    });

    it('should suspend (locking the owner out) and reactivate, idempotently', async () => {
      const created = await onboard(palm).expect(201);
      const id = created.body.data.developer.id as string;
      const owner = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'owner@palm.example.com', password: created.body.data.temporaryPassword })
        .expect(200);

      const suspended = await asSuper('post', `/api/v1/platform/developers/${id}/suspend`).expect(
        200,
      );
      await asSuper('post', `/api/v1/platform/developers/${id}/suspend`).expect(200);

      expect(suspended.body.data.status).toBe('suspended');
      const blocked = await http()
        .get('/api/v1/auth/me')
        .set(...bearer(owner.body.data.accessToken as string))
        .expect(403);
      expect(blocked.body.error.code).toBe('ORGANIZATION_SUSPENDED');
      expect(
        (await asSuper('get', '/api/v1/platform/developers?status=suspended').expect(200)).body
          .data,
      ).toHaveLength(1);

      await asSuper('post', `/api/v1/platform/developers/${id}/reactivate`).expect(200);
      await http()
        .get('/api/v1/auth/me')
        .set(...bearer(owner.body.data.accessToken as string))
        .expect(200);

      const audit = await asSuper('get', `/api/v1/platform/audit?organizationId=${id}`).expect(200);
      expect(audit.body.data.map((a: { action: string }) => a.action)).toEqual([
        'developer.reactivated',
        'developer.suspended',
        'developer.onboarded',
      ]);
    });
  });

  describe('invites', () => {
    const invite = {
      email: 'founder@harbor.example.com',
      firstName: 'Ali',
      lastName: 'Raza',
      organizationName: 'Harbor Homes',
      slug: 'harbor-homes',
    };

    it('should issue, preview and accept an invite that signs the new owner in', async () => {
      const issued = await asSuper('post', '/api/v1/platform/invites').send(invite).expect(201);
      expect(issued.body.data).toMatchObject({ ...invite, status: 'pending' });
      const token = await outboxLink('founder@harbor.example.com');

      const preview = await http().get(`/api/v1/public/invites/${token}`).expect(200);
      expect(preview.body.data).toEqual({
        ...invite,
        email: invite.email,
        expiresAt: expect.any(String),
      });
      delete (preview.body.data as Record<string, unknown>).expiresAt;

      const accepted = await http()
        .post(`/api/v1/public/invites/${token}/accept`)
        .send({ password: 'Harbor-Password-1', organizationName: 'Harbor Homes Ltd' })
        .expect(200);
      expect(accepted.body.data.user).toMatchObject({
        email: 'founder@harbor.example.com',
        plane: 'tenant',
        isSuperUser: true,
        mustResetPassword: false,
        organization: { name: 'Harbor Homes Ltd', slug: 'harbor-homes', status: 'active' },
      });
      expect(accepted.body.data.refreshToken).toEqual(expect.any(String));

      await http()
        .post(`/api/v1/public/invites/${token}/accept`)
        .send({ password: 'Harbor-Password-1' })
        .expect(404);
      await http().get(`/api/v1/public/invites/${token}`).expect(404);
      const list = await asSuper('get', '/api/v1/platform/invites?status=accepted').expect(200);
      expect(list.body.data).toHaveLength(1);
      const stats = await asSuper('get', '/api/v1/platform/stats').expect(200);
      expect(stats.body.data.recentActivity[0]).toMatchObject({
        type: 'organization.created',
        actorName: null,
      });
    });

    it('should validate the acceptance body', async () => {
      await asSuper('post', '/api/v1/platform/invites').send(invite).expect(201);
      const token = await outboxLink(invite.email);

      const extra = await http()
        .post(`/api/v1/public/invites/${token}/accept`)
        .send({ password: 'Harbor-Password-1', slug: 'x' })
        .expect(422);
      expect(extra.body.error.details.map((d: { field: string }) => d.field)).toEqual(['slug']);
      const short = await http()
        .post(`/api/v1/public/invites/${token}/accept`)
        .send({ password: 'short' })
        .expect(422);
      expect(short.body.error.details.map((d: { field: string }) => d.field)).toEqual(['password']);
    });

    it('should answer INVITE_PENDING for a second live invite to the same email', async () => {
      await asSuper('post', '/api/v1/platform/invites').send(invite).expect(201);

      const res = await asSuper('post', '/api/v1/platform/invites')
        .send({ ...invite, slug: 'harbor-two' })
        .expect(409);

      expect(res.body.error.code).toBe('INVITE_PENDING');
    });

    it('should resend expired invites with a new link and refuse actions on non-pending ones', async () => {
      const issued = await asSuper('post', '/api/v1/platform/invites').send(invite).expect(201);
      const id = issued.body.data.id as string;
      const oldToken = await outboxLink(invite.email);
      await sequelize.query(
        "UPDATE invites SET expires_at = now() - interval '1 day' WHERE id = :id",
        {
          replacements: { id },
        },
      );
      expect(
        (await asSuper('get', '/api/v1/platform/invites?status=expired').expect(200)).body.data,
      ).toHaveLength(1);

      const resent = await asSuper('post', `/api/v1/platform/invites/${id}/resend`).expect(200);
      expect(resent.body.data.status).toBe('pending');
      const newToken = await outboxLink(invite.email);
      expect(newToken).not.toBe(oldToken);
      await http().get(`/api/v1/public/invites/${oldToken}`).expect(404);

      await asSuper('post', `/api/v1/platform/invites/${id}/revoke`).expect(200);
      const again = await asSuper('post', `/api/v1/platform/invites/${id}/revoke`).expect(409);
      expect(again.body.error.code).toBe('INVITE_NOT_PENDING');
      expect(
        (await asSuper('post', `/api/v1/platform/invites/${id}/resend`).expect(409)).body.error
          .code,
      ).toBe('INVITE_NOT_PENDING');
      expect(
        (await http().get(`/api/v1/public/invites/${newToken}`).expect(404)).body.error.code,
      ).toBe('INVITE_INVALID');
    });
  });

  describe('platform admins', () => {
    it('should let the super user create an admin who must reset, and list both', async () => {
      const created = await asSuper('post', '/api/v1/platform/admins')
        .send({ email: 'ana@invespy.example.com', firstName: 'Ana', lastName: 'Lee' })
        .expect(201);

      expect(created.body.data.admin).toMatchObject({ role: 'platform_admin', isActive: true });
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'ana@invespy.example.com', password: created.body.data.temporaryPassword })
        .expect(200);
      expect(login.body.data.user.mustResetPassword).toBe(true);
      const list = await asSuper('get', '/api/v1/platform/admins').expect(200);
      expect(list.body.data.map((a: { role: string }) => a.role)).toEqual([
        'platform_super_user',
        'platform_admin',
      ]);
    });

    it('should refuse a platform admin who tries to create or deactivate admins', async () => {
      await createUser(sequelize, { email: 'admin2@invespy.example.com' });
      await sequelize.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT u.id, r.id FROM users u, roles r WHERE u.email = 'admin2@invespy.example.com' AND r.code = 'platform_admin'`,
      );
      const adminToken = await loginToken(app, 'admin2@invespy.example.com');

      const res = await http()
        .post('/api/v1/platform/admins')
        .set(...bearer(adminToken))
        .send({ email: 'x@invespy.example.com', firstName: 'X', lastName: 'Y' })
        .expect(403);

      expect(res.body.error.code).toBe('PERMISSION_DENIED');
      await http()
        .get('/api/v1/platform/admins')
        .set(...bearer(adminToken))
        .expect(200);
    });

    it('should deactivate an admin (locking them out) and protect the last super user', async () => {
      const created = await asSuper('post', '/api/v1/platform/admins')
        .send({ email: 'ana@invespy.example.com', firstName: 'Ana', lastName: 'Lee' })
        .expect(201);
      const adminId = created.body.data.admin.id as string;
      const anaToken = await loginToken(
        app,
        'ana@invespy.example.com',
        created.body.data.temporaryPassword as string,
      );

      const res = await asSuper('post', `/api/v1/platform/admins/${adminId}/deactivate`).expect(
        200,
      );
      expect(res.body.data.isActive).toBe(false);
      await http()
        .get('/api/v1/auth/me')
        .set(...bearer(anaToken))
        .expect(401);

      const list = await asSuper('get', '/api/v1/platform/admins').expect(200);
      const superId = (list.body.data as Array<{ id: string; role: string }>).find(
        (a) => a.role === 'platform_super_user',
      )!.id;
      const last = await asSuper('post', `/api/v1/platform/admins/${superId}/deactivate`).expect(
        409,
      );
      expect(last.body.error.code).toBe('LAST_SUPER_USER');
    });
  });

  describe('stats and audit', () => {
    it('should return counts, 8 weeks and recent activity', async () => {
      await onboard(palm).expect(201);

      const res = await asSuper('get', '/api/v1/platform/stats').expect(200);

      expect(res.body.data.counts.organizations).toEqual({ total: 1, active: 1, suspended: 0 });
      expect(res.body.data.counts.users).toEqual({ total: 1 });
      expect(res.body.data.trends.weeks).toHaveLength(8);
      expect(res.body.data.recentActivity[0]).toMatchObject({
        type: 'organization.created',
        organizationName: 'Palm Estates',
        actorName: 'Ops Lead',
      });
      await asSuper('get', '/api/v1/platform/stats?weeks=27').expect(422);
    });

    it('should keep secrets out of the audit trail', async () => {
      await onboard(palm).expect(201);

      const res = await asSuper('get', '/api/v1/platform/audit?action=developer.onboarded').expect(
        200,
      );

      expect(JSON.stringify(res.body.data)).not.toMatch(/Tmp-|password|hash/i);
      expect(res.body.data[0].actor).toMatchObject({
        email: 'platform@example.com',
        name: 'Ops Lead',
      });
    });
  });
});
