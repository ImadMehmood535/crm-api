import { INestApplication } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { App } from 'supertest/types';

import { createTestApp } from './support/app';
import { truncateAll } from './support/db';
import { PASSWORD, createOrganization, createRole, createUser } from './support/fixtures';

interface SessionBody {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: Record<string, unknown>;
}

describe('Auth sessions (e2e)', () => {
  let app: INestApplication<App>;
  let sequelize: Sequelize;
  let orgId: string;

  const http = () => request(app.getHttpServer());
  const login = (email: string, password = PASSWORD) =>
    http().post('/api/v1/auth/login').send({ email, password });
  const session = async (email: string): Promise<SessionBody> =>
    (await login(email).expect(200)).body.data as SessionBody;
  const refresh = (refreshToken: string) =>
    http().post('/api/v1/auth/refresh').send({ refreshToken });
  const me = (token: string) =>
    http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
  const setOrgStatus = (status: string) =>
    sequelize.query('UPDATE organizations SET status = :status WHERE id = :orgId', {
      replacements: { status, orgId },
    });

  beforeAll(async () => {
    ({ app, sequelize } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    const platformRole = await createRole(sequelize, {
      code: 'platform_super_user',
      isSystemRole: true,
    });
    await createUser(sequelize, { email: 'platform@example.com', roleIds: [platformRole] });
    orgId = await createOrganization(sequelize, { name: 'Skyline', slug: 'skyline' });
    const ownerRole = await createRole(sequelize, {
      code: 'developer_super_user',
      organizationId: orgId,
    });
    await createUser(sequelize, {
      email: 'owner@example.com',
      organizationId: orgId,
      roleIds: [ownerRole],
    });
    await createUser(sequelize, {
      email: 'gone@example.com',
      organizationId: orgId,
      status: 'inactive',
    });
    await createUser(sequelize, {
      email: 'temp@example.com',
      organizationId: orgId,
      mustReset: true,
    });
  });

  afterAll(() => app.close());

  describe('login', () => {
    it('should return a full AuthSession for correct credentials', async () => {
      const res = await login('owner@example.com').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 900,
        user: {
          id: expect.any(String),
          email: 'owner@example.com',
          firstName: 'Test',
          lastName: 'User',
          plane: 'tenant',
          roles: ['developer_super_user'],
          isSuperUser: true,
          organization: { id: orgId, name: 'Skyline', slug: 'skyline', status: 'active' },
          mustResetPassword: false,
          permissions: [],
        },
      });
    });

    it('should describe the platform super user', async () => {
      const { user } = await session('platform@example.com');

      expect(user).toMatchObject({
        plane: 'platform',
        roles: ['platform_super_user'],
        isSuperUser: true,
        organization: null,
        permissions: [],
      });
    });

    it('should match the email case-insensitively', async () => {
      await login('  Owner@Example.COM ').expect(200);
    });

    it('should answer 422 for a missing password', async () => {
      const res = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'owner@example.com' })
        .expect(422);

      expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(['password']);
    });

    it.each([
      ['an unknown email', 'nobody@example.com', PASSWORD],
      ['a wrong password', 'owner@example.com', 'Wrong-Password-99'],
    ])('should answer 401 INVALID_CREDENTIALS for %s', async (_, email, password) => {
      const res = await login(email, password).expect(401);

      expect(res.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('should answer 403 ORGANIZATION_SUSPENDED only after a correct password', async () => {
      await setOrgStatus('suspended');

      await login('owner@example.com', 'Wrong-Password-99').expect(401);
      const res = await login('owner@example.com').expect(403);
      expect(res.body.error.code).toBe('ORGANIZATION_SUSPENDED');
    });

    it('should answer 403 ACCOUNT_INACTIVE for an inactive user', async () => {
      const res = await login('gone@example.com').expect(403);

      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('refresh', () => {
    it('should rotate the refresh token and return a new session', async () => {
      const first = await session('owner@example.com');

      const res = await refresh(first.refreshToken).expect(200);

      expect(res.body.data.refreshToken).not.toBe(first.refreshToken);
      await me(res.body.data.accessToken as string).expect(200);
    });

    it('should answer 401 for an unknown refresh token', async () => {
      const res = await refresh('not-a-real-token').expect(401);

      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should revoke the whole chain when a rotated token is replayed', async () => {
      const a = await session('owner@example.com');
      const b = (await refresh(a.refreshToken).expect(200)).body.data as SessionBody;

      await refresh(a.refreshToken).expect(401);

      await refresh(b.refreshToken).expect(401);
      await me(b.accessToken).expect(401);
    });

    it('should refuse a refresh for a suspended company and allow it again after reactivation', async () => {
      const s = await session('owner@example.com');
      await setOrgStatus('suspended');

      const res = await refresh(s.refreshToken).expect(403);
      expect(res.body.error.code).toBe('ORGANIZATION_SUSPENDED');

      await setOrgStatus('active');
      await refresh(s.refreshToken).expect(200);
    });
  });

  describe('authenticated requests', () => {
    it('should answer 401 without a token', async () => {
      const res = await http().get('/api/v1/auth/me').expect(401);

      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should answer 401 for a tampered token', async () => {
      const { accessToken } = await session('owner@example.com');

      await me(`${accessToken.slice(0, -3)}abc`).expect(401);
    });

    it('should answer 401 for a token signed with another secret', async () => {
      const forged = sign({ sid: 'x' }, 'another-secret-that-is-long-enough-123', {
        subject: 'x',
        issuer: 'crm-developer-api',
        audience: 'crm-developer-ui',
      });

      await me(forged).expect(401);
    });

    it('should answer 403 ORGANIZATION_SUSPENDED on the next request after suspension', async () => {
      const { accessToken } = await session('owner@example.com');
      await setOrgStatus('suspended');

      const res = await me(accessToken).expect(403);

      expect(res.body.error.code).toBe('ORGANIZATION_SUSPENDED');
    });

    it('should keep an access token valid after its chain was refreshed (other tabs)', async () => {
      const first = await session('owner@example.com');
      await refresh(first.refreshToken).expect(200);

      await me(first.accessToken).expect(200);
    });
  });

  describe('forced password reset', () => {
    it('should allow me but block other endpoints with PASSWORD_RESET_REQUIRED', async () => {
      const { accessToken, user } = await session('temp@example.com');

      expect(user.mustResetPassword).toBe(true);
      const allowed = await me(accessToken).expect(200);
      expect(allowed.body.data.mustResetPassword).toBe(true);
    });

    it('should reset, clear the flag and revoke the old sessions', async () => {
      const old = await session('temp@example.com');

      const res = await http()
        .post('/api/v1/auth/reset-password')
        .set('Authorization', `Bearer ${old.accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'Brand-New-Password-1' })
        .expect(200);

      expect(res.body.data.user.mustResetPassword).toBe(false);
      await refresh(old.refreshToken).expect(401);
      await me(old.accessToken).expect(401);
      await me(res.body.data.accessToken as string).expect(200);
      await login('temp@example.com', 'Brand-New-Password-1').expect(200);
    });

    it('should answer 401 INVALID_CREDENTIALS for a wrong current password', async () => {
      const { accessToken } = await session('temp@example.com');

      const res = await http()
        .post('/api/v1/auth/reset-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'Wrong-Password-99', newPassword: 'Brand-New-Password-1' })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it.each([
      ['too short', 'Short-pass1'],
      ['the same as the current one', PASSWORD],
    ])('should answer 422 on newPassword when it is %s', async (_, newPassword) => {
      const { accessToken } = await session('temp@example.com');

      const res = await http()
        .post('/api/v1/auth/reset-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword })
        .expect(422);

      expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual([
        'newPassword',
      ]);
    });
  });

  describe('logout', () => {
    it('should end this login chain and leave other devices signed in', async () => {
      const here = await session('owner@example.com');
      const elsewhere = await session('owner@example.com');

      const res = await http()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${here.accessToken}`)
        .expect(200);

      expect(res.body).toEqual({ success: true, data: null });
      await refresh(here.refreshToken).expect(401);
      await me(elsewhere.accessToken).expect(200);
    });
  });

  describe('secrets', () => {
    it('should store only the digest of the refresh token', async () => {
      const { refreshToken } = await session('owner@example.com');

      const [rows] = await sequelize.query('SELECT refresh_token_hash FROM user_sessions');
      const hashes = (rows as { refresh_token_hash: string }[]).map((r) => r.refresh_token_hash);
      expect(hashes).not.toContain(refreshToken);
      expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
