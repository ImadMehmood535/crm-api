import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createHierarchy } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { DEPARTMENT_HEAD_PERMISSIONS } from '../../shared/auth/LevelRoles';
import { TenantPersistenceModule } from '../persistence/TenantPersistenceModule';
import { IRbacQueries, RBAC_QUERIES } from '../queries/abstraction/IRbacQueries';
import { ITenantUserQueries, TENANT_USER_QUERIES } from '../queries/abstraction/ITenantUserQueries';
import { IRoleRepository, ROLE_REPOSITORY } from './abstraction/IRoleRepository';
import { IUserRepository, USER_REPOSITORY } from './abstraction/IUserRepository';

describe('Built-in level roles', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let roles: IRoleRepository;
  let users: IUserRepository;
  let rbac: IRbacQueries;
  let tenantUsers: ITenantUserQueries;
  let h: Record<string, string>;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([TenantPersistenceModule]));
    roles = moduleRef.get(ROLE_REPOSITORY);
    users = moduleRef.get(USER_REPOSITORY);
    rbac = moduleRef.get(RBAC_QUERIES);
    tenantUsers = moduleRef.get(TENANT_USER_QUERIES);
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    h = await createHierarchy(sequelize);
  });
  afterAll(() => moduleRef.close());

  const permissionsOf = async (userId: string): Promise<string[]> =>
    (await tenantUsers.findById(h.org, userId, { userId: h.owner, level: 'owner' }))!.permissions;

  it('should create each level role once and reuse it', async () => {
    const admin = await roles.levelRoleId(h.org, 'admin');

    expect(await roles.levelRoleId(h.org, 'admin')).toBe(admin);
    expect(await roles.levelRoleId(h.org, 'department_head')).not.toBe(admin);
    expect(await roles.findTenantRole(h.org, admin)).toMatchObject({
      name: 'Admin',
      isSystem: true,
    });
  });

  it('should give admins every code and heads exactly the head set', async () => {
    await users.replaceRoles(h.admin1, [await roles.levelRoleId(h.org, 'admin')], h.owner);
    await users.replaceRoles(h.head1, [await roles.levelRoleId(h.org, 'department_head')], h.owner);

    expect(await permissionsOf(h.admin1)).toEqual(await permissionsOf(h.owner));
    expect(await permissionsOf(h.admin1)).toHaveLength(26);
    expect(await permissionsOf(h.head1)).toEqual([...DEPARTMENT_HEAD_PERMISSIONS]);
    const admin = await tenantUsers.findById(h.org, h.admin1, { userId: h.owner, level: 'owner' });
    expect(admin).toMatchObject({ isOwner: false, level: 'admin' });
  });

  it('should list level roles as built-in roles after the owner role, with derived codes', async () => {
    await roles.levelRoleId(h.org, 'admin');
    await roles.levelRoleId(h.org, 'department_head');

    const { rows } = await rbac.findRoles({ organizationId: h.org, page: 1, pageSize: 20 });

    expect(rows[0]).toMatchObject({ id: h.ownerRole, isSystem: true });
    expect(rows.slice(1).map((r) => [r.name, r.isSystem])).toEqual([
      ['Admin', true],
      ['Department Head', true],
    ]);
    expect(rows[1].permissions).toHaveLength(26);
    expect(rows[2].permissions).toEqual([...DEPARTMENT_HEAD_PERMISSIONS]);
  });
});
