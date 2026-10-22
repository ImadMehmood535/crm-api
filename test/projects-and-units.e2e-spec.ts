import { INestApplication } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { App } from 'supertest/types';

import { seedPlatformIdentity } from '../seeds/platform-identity.seed';
import { createTestApp } from './support/app';
import { truncateAll } from './support/db';
import { PASSWORD, createOrganization, createRole, createUser, grant } from './support/fixtures';
import { bearer, loginToken } from './support/http';

describe('Projects and units (e2e)', () => {
  let app: INestApplication<App>;
  let sequelize: Sequelize;
  let owner: string;
  let orgId: string;

  const as = (token: string, method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(app.getHttpServer())
      [method](url)
      .set(...bearer(token));
  const newProject = (body: object = {}) =>
    as(owner, 'post', '/api/v1/projects').send({
      name: 'Palm Heights',
      city: 'Lahore',
      currency: 'pkr',
      ...body,
    });

  beforeAll(async () => {
    ({ app, sequelize } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    orgId = await createOrganization(sequelize);
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
    owner = await loginToken(app, 'owner@example.com');
  });

  afterAll(() => app.close());

  describe('projects', () => {
    it('should create with defaults and list newest first with counts and search', async () => {
      const created = await newProject().expect(201);
      expect(created.body.data).toMatchObject({
        name: 'Palm Heights',
        city: 'Lahore',
        currency: 'PKR',
        status: 'planning',
        expectedCompletion: null,
        unitCounts: { total: 0, available: 0, reserved: 0, sold: 0, blocked: 0 },
      });
      await newProject({ name: 'Sky Towers', city: 'Karachi' }).expect(201);

      const list = await as(owner, 'get', '/api/v1/projects?page=1&pageSize=20').expect(200);
      expect(list.body.data.map((p: { name: string }) => p.name)).toEqual([
        'Sky Towers',
        'Palm Heights',
      ]);
      expect(
        (await as(owner, 'get', '/api/v1/projects?search=lahore').expect(200)).body.meta.total,
      ).toBe(1);
    });

    it('should reject a duplicate name ignoring case and spaces, and bad fields together', async () => {
      await newProject().expect(201);

      expect((await newProject({ name: 'palm  HEIGHTS' }).expect(409)).body.error.code).toBe(
        'PROJECT_NAME_CONFLICT',
      );
      const bad = await newProject({
        name: 'A',
        currency: 'RS',
        expectedCompletion: 'soon',
      }).expect(422);
      expect(bad.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
        'currency',
        'expectedCompletion',
        'name',
      ]);
    });

    it('should patch partially, clearing with null, and hide other companies', async () => {
      const id = (await newProject({ expectedCompletion: '2027-06-30' }).expect(201)).body.data
        .id as string;

      const res = await as(owner, 'patch', `/api/v1/projects/${id}`)
        .send({ city: null, status: 'active' })
        .expect(200);

      expect(res.body.data).toMatchObject({
        city: null,
        status: 'active',
        expectedCompletion: '2027-06-30',
        currency: 'PKR',
      });
      const other = await createOrganization(sequelize);
      const otherRole = await createRole(sequelize, {
        code: 'developer_super_user',
        organizationId: other,
        isSystemRole: true,
      });
      await createUser(sequelize, {
        email: 'x@other.com',
        organizationId: other,
        roleIds: [otherRole],
      });
      await as(await loginToken(app, 'x@other.com'), 'get', `/api/v1/projects/${id}`).expect(404);
    });

    it('should refuse deleting a project with units and delete an empty one', async () => {
      const id = (await newProject().expect(201)).body.data.id as string;
      const unit = (
        await as(owner, 'post', `/api/v1/projects/${id}/units`).send({ number: 'A-1' }).expect(201)
      ).body.data.id as string;

      expect(
        (await as(owner, 'delete', `/api/v1/projects/${id}`).expect(409)).body.error.code,
      ).toBe('PROJECT_HAS_UNITS');
      await as(owner, 'delete', `/api/v1/units/${unit}`).expect(200);
      expect((await as(owner, 'delete', `/api/v1/projects/${id}`).expect(200)).body).toEqual({
        success: true,
        data: null,
      });
      await as(owner, 'get', `/api/v1/projects/${id}`).expect(404);
    });
  });

  describe('units', () => {
    let projectId: string;

    beforeEach(async () => {
      projectId = (await newProject().expect(201)).body.data.id as string;
    });

    it('should create units with numbers as numbers and list them in natural order with filters', async () => {
      const villa = await as(owner, 'post', `/api/v1/projects/${projectId}/units`)
        .send({ number: 'A-101', type: 'villa', bedrooms: 4, price: 250000.5, areaSqm: 320.25 })
        .expect(201);
      expect(villa.body.data).toMatchObject({
        projectId,
        type: 'villa',
        status: 'available',
        bedrooms: 4,
        price: 250000.5,
        areaSqm: 320.25,
      });
      for (const number of ['A-10', 'A-2']) {
        await as(owner, 'post', `/api/v1/projects/${projectId}/units`).send({ number }).expect(201);
      }

      const list = await as(owner, 'get', `/api/v1/projects/${projectId}/units`).expect(200);
      expect(list.body.data.map((u: { number: string }) => u.number)).toEqual([
        'A-2',
        'A-10',
        'A-101',
      ]);
      expect(
        (await as(owner, 'get', `/api/v1/projects/${projectId}/units?type=villa`).expect(200)).body
          .meta.total,
      ).toBe(1);
      const project = await as(owner, 'get', `/api/v1/projects/${projectId}`).expect(200);
      expect(project.body.data.unitCounts).toEqual({
        total: 3,
        available: 3,
        reserved: 0,
        sold: 0,
        blocked: 0,
      });
    });

    it('should report every bad field and duplicate numbers', async () => {
      const bad = await as(owner, 'post', `/api/v1/projects/${projectId}/units`)
        .send({ number: 'B-1', bedrooms: 2.5, floor: 300, price: 10.123 })
        .expect(422);
      expect(bad.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
        'bedrooms',
        'floor',
        'price',
      ]);
      await as(owner, 'post', `/api/v1/projects/${projectId}/units`)
        .send({ number: 'B-1' })
        .expect(201);
      expect(
        (
          await as(owner, 'post', `/api/v1/projects/${projectId}/units`)
            .send({ number: 'b-1' })
            .expect(409)
        ).body.error.code,
      ).toBe('UNIT_NUMBER_CONFLICT');
    });

    it('should let a user with only units.edit change the status inline', async () => {
      const id = (
        await as(owner, 'post', `/api/v1/projects/${projectId}/units`)
          .send({ number: 'A-1' })
          .expect(201)
      ).body.data.id as string;
      const sales = await createRole(sequelize, { code: 'sales', organizationId: orgId });
      await grant(sequelize, sales, ['projects.view', 'units.view', 'units.edit']);
      await createUser(sequelize, {
        email: 'sales@example.com',
        organizationId: orgId,
        roleIds: [sales],
        password: PASSWORD,
      });
      const salesToken = await loginToken(app, 'sales@example.com');

      const res = await as(salesToken, 'patch', `/api/v1/units/${id}`)
        .send({ status: 'sold' })
        .expect(200);

      expect(res.body.data.status).toBe('sold');
      const project = await as(salesToken, 'get', `/api/v1/projects/${projectId}`).expect(200);
      expect(project.body.data.unitCounts.sold).toBe(1);
      await as(salesToken, 'delete', `/api/v1/units/${id}`).expect(403);
      await as(salesToken, 'post', `/api/v1/projects/${projectId}/units`)
        .send({ number: 'Z' })
        .expect(403);
    });

    it('should answer 404 for units of an unknown project', async () => {
      await as(owner, 'get', '/api/v1/projects/0192f3a4-0000-7000-8000-000000000000/units').expect(
        404,
      );
      await as(owner, 'get', '/api/v1/units/0192f3a4-0000-7000-8000-000000000000').expect(404);
    });
  });

  it('should report inventory totals in platform stats', async () => {
    await seedPlatformIdentity(sequelize, {
      email: 'platform@example.com',
      password: PASSWORD,
      firstName: 'Ops',
      lastName: 'Lead',
    });
    const id = (await newProject().expect(201)).body.data.id as string;
    await as(owner, 'post', `/api/v1/projects/${id}/units`).send({ number: 'A-1' }).expect(201);

    const res = await as(
      await loginToken(app, 'platform@example.com'),
      'get',
      '/api/v1/platform/stats',
    ).expect(200);

    expect(res.body.data.counts).toMatchObject({ projects: { total: 1 }, units: { total: 1 } });
  });
});
