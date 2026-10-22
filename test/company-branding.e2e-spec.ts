import { INestApplication } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { App } from 'supertest/types';

import { createTestApp } from './support/app';
import { truncateAll } from './support/db';
import { createOrganization, createRole, createUser, grant } from './support/fixtures';
import { bearer, loginToken } from './support/http';

const png = (size = 64): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(size - 8, 7),
  ]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('Company branding (e2e)', () => {
  let app: INestApplication<App>;
  let sequelize: Sequelize;
  let owner: string;
  let viewer: string;

  const http = () => request(app.getHttpServer());
  const upload = (token: string, kind: string, body: Buffer, type = 'image/png') =>
    http()
      .post(`/api/v1/me/branding/assets/${kind}`)
      .set(...bearer(token))
      .set('Content-Type', type)
      .send(body);

  beforeAll(async () => {
    ({ app, sequelize } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    const orgId = await createOrganization(sequelize);
    const ownerRole = await createRole(sequelize, {
      code: 'developer_super_user',
      organizationId: orgId,
      isSystemRole: true,
    });
    await createUser(sequelize, {
      email: 'owner@example.com',
      organizationId: orgId,
      roleIds: [ownerRole],
    });
    const view = await createRole(sequelize, { code: 'viewer', organizationId: orgId });
    await grant(sequelize, view, ['branding.view']);
    await createUser(sequelize, {
      email: 'viewer@example.com',
      organizationId: orgId,
      roleIds: [view],
    });
    owner = await loginToken(app, 'owner@example.com');
    viewer = await loginToken(app, 'viewer@example.com');
  });

  afterAll(() => app.close());

  it('should answer 404 until something is configured, then let any tenant user read it', async () => {
    expect(
      (
        await http()
          .get('/api/v1/me/branding')
          .set(...bearer(owner))
          .expect(404)
      ).body.error.code,
    ).toBe('NOT_FOUND');

    await http()
      .put('/api/v1/me/branding')
      .set(...bearer(owner))
      .send({ primaryColor: '#0D9488', accentColor: '#f97316' })
      .expect(200);

    const res = await http()
      .get('/api/v1/me/branding')
      .set(...bearer(viewer))
      .expect(200);
    expect(res.body.data).toEqual({
      primaryColor: '#0d9488',
      secondaryColor: null,
      accentColor: '#f97316',
      logoUrl: null,
      faviconUrl: null,
      backgroundImageUrl: null,
    });
  });

  it('should report every bad colour, clear with null, and refuse read-only users', async () => {
    const bad = await http()
      .put('/api/v1/me/branding')
      .set(...bearer(owner))
      .send({ primaryColor: 'teal', secondaryColor: '#12' })
      .expect(422);
    expect(bad.body.error.details.map((d: { field: string }) => d.field)).toEqual([
      'primaryColor',
      'secondaryColor',
    ]);

    await http()
      .put('/api/v1/me/branding')
      .set(...bearer(owner))
      .send({ primaryColor: '#111111' })
      .expect(200);
    const cleared = await http()
      .put('/api/v1/me/branding')
      .set(...bearer(owner))
      .send({ primaryColor: null })
      .expect(200);
    expect(cleared.body.data.primaryColor).toBeNull();

    expect(
      (
        await http()
          .put('/api/v1/me/branding')
          .set(...bearer(viewer))
          .send({ primaryColor: '#111111' })
          .expect(403)
      ).body.error.code,
    ).toBe('PERMISSION_DENIED');
  });

  it('should store a logo, serve it publicly with safe headers, and give a replacement a new URL', async () => {
    const image = png(2048);
    const res = await upload(owner, 'logo', image).expect(200);
    const url = res.body.data.logoUrl as string;
    expect(url).toMatch(/^\/api\/v1\/branding-assets\/[0-9a-f-]{36}$/);

    const served = await http()
      .get(url)
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-disposition']).toBe('inline');
    expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(Buffer.compare(served.body as Buffer, image)).toBe(0);

    const replaced = await upload(owner, 'logo', png(100)).expect(200);
    expect(replaced.body.data.logoUrl).not.toBe(url);
    await http().get(url).expect(404);
  });

  it('should refuse bad kinds, empty bodies, oversized images and non-images', async () => {
    expect((await upload(owner, 'banner', png()).expect(422)).body.error.details[0].field).toBe(
      'kind',
    );
    expect(
      (await upload(owner, 'logo', Buffer.alloc(0)).expect(422)).body.error.details[0].field,
    ).toBe('file');
    expect((await upload(owner, 'favicon', png(200 * 1024)).expect(413)).body.error.code).toBe(
      'PAYLOAD_TOO_LARGE',
    );
    expect(
      (await upload(owner, 'background', png(2.5 * 1024 * 1024)).expect(413)).body.error.code,
    ).toBe('PAYLOAD_TOO_LARGE');
    expect((await upload(owner, 'logo', SVG, 'image/svg+xml').expect(415)).body.error.code).toBe(
      'UNSUPPORTED_MEDIA_TYPE',
    );
    expect(
      (await upload(owner, 'logo', Buffer.from('not an image'), 'image/png').expect(415)).body.error
        .code,
    ).toBe('UNSUPPORTED_MEDIA_TYPE');
    await upload(viewer, 'logo', png()).expect(403);
  });

  it('should remove an image', async () => {
    const url = (await upload(owner, 'favicon', png()).expect(200)).body.data.faviconUrl as string;

    const res = await http()
      .delete('/api/v1/me/branding/assets/favicon')
      .set(...bearer(owner))
      .expect(200);

    expect(res.body.data.faviconUrl).toBeNull();
    await http().get(url).expect(404);
  });
});
