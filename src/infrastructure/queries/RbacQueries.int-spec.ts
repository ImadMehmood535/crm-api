import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createOrganization, createRole, createUser, grant } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { TenantPersistenceModule } from '../persistence/TenantPersistenceModule';
import { IRbacQueries, RBAC_QUERIES } from './abstraction/IRbacQueries';
import { ITenantUserQueries, TENANT_USER_QUERIES } from './abstraction/ITenantUserQueries';

describe('RbacQueries / TenantUserQueries', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let rbac: IRbacQueries;
  let tenantUsers: ITenantUserQueries;
  let orgId: string;
  let ownerRole: string;
  let sales: string;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([TenantPersistenceModule]));
    rbac = moduleRef.get(RBAC_QUERIES);
    tenantUsers = moduleRef.get(TENANT_USER_QUERIES);
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    orgId = await createOrganization(sequelize);
    ownerRole = await createRole(sequelize, {
      code: 'developer_super_user',
      organizationId: orgId,
      isSystemRole: true,
    });
    sales = await createRole(sequelize, { code: 'sales', organizationId: orgId });
    await grant(sequelize, sales, ['users.view', 'projects.view']);
    await createRole(sequelize, { code: 'zz_old', organizationId: orgId, isActive: false });
  });

  afterAll(() => moduleRef.close());

  it('should return the catalogue grouped by module in seed order', async () => {
    const catalogue = await rbac.catalogue();

    expect(catalogue.map((m) => m.module)).toEqual([
      'users',
      'roles',
      'projects',
      'units',
      'branding',
    ]);
    expect(catalogue[0]).toEqual({
      module: 'users',
      label: 'Users',
      actions: [
        { action: 'view', label: 'View users', code: 'users.view' },
        { action: 'create', label: 'Add users', code: 'users.create' },
        { action: 'edit', label: 'Edit users and their roles', code: 'users.edit' },
        { action: 'deactivate', label: 'Deactivate / reactivate users', code: 'users.deactivate' },
      ],
    });
    expect(await rbac.allCodes()).toHaveLength(18);
  });

  it('should list active roles, system first, with permissions and holder counts', async () => {
    await createUser(sequelize, {
      email: 'o@example.com',
      organizationId: orgId,
      roleIds: [ownerRole],
    });
    await createUser(sequelize, {
      email: 's@example.com',
      organizationId: orgId,
      roleIds: [sales],
    });

    const { rows, total } = await rbac.findRoles({ organizationId: orgId, page: 1, pageSize: 20 });

    expect(total).toBe(2);
    expect(rows.map((r) => [r.code, r.isSystem, r.userCount])).toEqual([
      ['developer_super_user', true, 1],
      ['sales', false, 1],
    ]);
    expect(rows[0].permissions).toHaveLength(18);
    expect(rows[1].permissions).toEqual(['projects.view', 'users.view']);
    expect(
      (await rbac.findRoles({ organizationId: orgId, page: 1, pageSize: 20, search: 'SAL' })).total,
    ).toBe(1);
    expect(await rbac.findRole(await createOrganization(sequelize), sales)).toBeNull();
  });

  it('should list company users with roles, effective permissions and the owner flag', async () => {
    const owner = await createUser(sequelize, {
      email: 'o@example.com',
      organizationId: orgId,
      roleIds: [ownerRole],
      firstName: 'Sara',
      lastName: 'Khan',
    });
    const staff = await createUser(sequelize, {
      email: 's@example.com',
      organizationId: orgId,
      roleIds: [sales],
      status: 'inactive',
    });
    const other = await createOrganization(sequelize);
    await createUser(sequelize, { email: 'x@example.com', organizationId: other });

    const { rows, total } = await tenantUsers.findList({
      organizationId: orgId,
      page: 1,
      pageSize: 20,
    });

    expect(total).toBe(2);
    expect(rows.map((u) => [u.id, u.isOwner])).toEqual([
      [owner, true],
      [staff, false],
    ]);
    expect(rows[0].permissions).toHaveLength(18);
    expect(rows[1]).toMatchObject({
      status: 'inactive',
      roles: [{ id: sales, name: 'sales', code: 'sales' }],
      permissions: ['projects.view', 'users.view'],
      lastLoginAt: null,
    });
    expect(
      (
        await tenantUsers.findList({
          organizationId: orgId,
          page: 1,
          pageSize: 20,
          search: 'sara khan',
        })
      ).total,
    ).toBe(1);
    expect(
      (
        await tenantUsers.findList({
          organizationId: orgId,
          page: 1,
          pageSize: 20,
          status: 'active',
        })
      ).total,
    ).toBe(1);
    expect(await tenantUsers.findById(other, owner)).toBeNull();
  });
});
