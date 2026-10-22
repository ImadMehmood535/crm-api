import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createOrganization, createRole, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { PlatformPersistenceModule } from '../persistence/PlatformPersistenceModule';
import { IPlatformAdminQueries, PLATFORM_ADMIN_QUERIES } from './abstraction/IPlatformAdminQueries';

describe('PlatformAdminQueries', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let queries: IPlatformAdminQueries;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([PlatformPersistenceModule]));
    queries = moduleRef.get(PLATFORM_ADMIN_QUERIES);
  });
  beforeEach(() => truncateAll(sequelize));
  afterAll(() => moduleRef.close());

  it('should list platform users only, with their role and active flag', async () => {
    const superRole = await createRole(sequelize, { code: 'platform_super_user' });
    const adminRole = await createRole(sequelize, { code: 'platform_admin' });
    const owner = await createUser(sequelize, { email: 'owner@example.com', roleIds: [superRole] });
    const admin = await createUser(sequelize, {
      email: 'admin@example.com',
      roleIds: [adminRole],
      status: 'inactive',
    });
    const org = await createOrganization(sequelize);
    await createUser(sequelize, { email: 'tenant@example.com', organizationId: org });

    const { rows, total } = await queries.findList({ page: 1, pageSize: 20 });

    expect(total).toBe(2);
    expect(rows.map((r) => [r.id, r.role, r.isActive])).toEqual([
      [owner, 'platform_super_user', true],
      [admin, 'platform_admin', false],
    ]);
    expect(await queries.findById(admin)).toMatchObject({
      email: 'admin@example.com',
      firstName: 'Test',
    });
  });
});
