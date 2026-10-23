import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createHierarchy, createRole, grant } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { TenantPersistenceModule } from '../persistence/TenantPersistenceModule';
import { ITenantUserQueries, TENANT_USER_QUERIES } from '../queries/abstraction/ITenantUserQueries';
import { IUserRepository, USER_REPOSITORY } from './abstraction/IUserRepository';

describe('Per-user permission overrides', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let users: IUserRepository;
  let queries: ITenantUserQueries;
  let h: Record<string, string>;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([TenantPersistenceModule]));
    users = moduleRef.get(USER_REPOSITORY);
    queries = moduleRef.get(TENANT_USER_QUERIES);
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    h = await createHierarchy(sequelize);
    const sales = await createRole(sequelize, { code: 'sales', organizationId: h.org });
    await grant(sequelize, sales, ['projects.view', 'units.view']);
    await users.replaceRoles(h.member1, [sales], h.owner);
  });
  afterAll(() => moduleRef.close());

  it('should report role codes only when there are no overrides', async () => {
    expect(await queries.findPermissionBreakdown(h.member1)).toEqual({
      rolePermissions: ['projects.view', 'units.view'],
      granted: [],
      revoked: [],
      permissions: ['projects.view', 'units.view'],
    });
  });

  it('should add grants, remove revokes, and clear them again', async () => {
    await users.replacePermissionOverrides(h.member1, ['projects.edit'], ['units.view'], h.owner);

    expect(await queries.findPermissionBreakdown(h.member1)).toEqual({
      rolePermissions: ['projects.view', 'units.view'],
      granted: ['projects.edit'],
      revoked: ['units.view'],
      permissions: ['projects.edit', 'projects.view'],
    });
    const listed = await queries.findById(h.org, h.member1, { userId: h.owner, level: 'owner' });
    expect(listed?.permissions).toEqual(['projects.edit', 'projects.view']);

    await users.replacePermissionOverrides(h.member1, [], [], h.owner);
    expect((await queries.findPermissionBreakdown(h.member1)).permissions).toEqual([
      'projects.view',
      'units.view',
    ]);
  });
});
