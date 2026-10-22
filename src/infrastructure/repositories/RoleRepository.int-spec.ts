import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createOrganization, createRole, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { Role } from '../../domain/aggregates/RoleAggregate/Role';
import { TenantPersistenceModule } from '../persistence/TenantPersistenceModule';
import { IRoleRepository, ROLE_REPOSITORY } from './abstraction/IRoleRepository';
import { IUserRepository, USER_REPOSITORY } from './abstraction/IUserRepository';

describe('RoleRepository (tenant roles) / UserRepository.replaceRoles', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let roles: IRoleRepository;
  let users: IUserRepository;
  let orgId: string;
  let ownerId: string;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([TenantPersistenceModule]));
    roles = moduleRef.get(ROLE_REPOSITORY);
    users = moduleRef.get(USER_REPOSITORY);
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    orgId = await createOrganization(sequelize);
    ownerId = await createUser(sequelize, { email: 'owner@example.com', organizationId: orgId });
  });
  afterAll(() => moduleRef.close());

  const newRole = (name: string, permissions: string[]) =>
    Role.create({ organizationId: orgId, name, description: null, permissions });

  it('should save a role with its grants and read it back', async () => {
    const saved = await roles.saveTenantRole(
      newRole('Sales', ['users.view', 'projects.view']),
      ownerId,
    );

    const found = await roles.findTenantRole(orgId, saved.id as string);

    expect(found?.code).toBe('sales');
    expect(found?.permissions).toEqual(['projects.view', 'users.view']);
    expect(
      await roles.findTenantRole(await createOrganization(sequelize), saved.id as string),
    ).toBeNull();
  });

  it('should replace the grant set and deactivate, freeing the code for reuse', async () => {
    const saved = await roles.saveTenantRole(newRole('Sales', ['users.view']), ownerId);
    saved.grant(['roles.view']);
    saved.deactivate();

    await roles.updateTenantRole(saved, ownerId);

    const found = await roles.findTenantRole(orgId, saved.id as string);
    expect(found?.permissions).toEqual(['roles.view']);
    expect(found?.isActive).toBe(false);
    expect(await roles.activeCodeExists(orgId, 'sales')).toBe(false);
    await roles.saveTenantRole(newRole('Sales', []), ownerId);
    expect(await roles.activeCodeExists(orgId, 'sales')).toBe(true);
  });

  it('should find only active roles of the company and count holders', async () => {
    const a = await roles.saveTenantRole(newRole('A role', []), ownerId);
    const off = await createRole(sequelize, {
      code: 'off',
      organizationId: orgId,
      isActive: false,
    });
    await users.replaceRoles(ownerId, [a.id as string], ownerId);

    const found = await roles.findActiveTenantRoles(orgId, [a.id as string, off]);

    expect(found.map((r) => r.id)).toEqual([a.id]);
    expect(await roles.countHolders(a.id as string)).toBe(1);
    expect(await roles.activeCodeExists(orgId, 'a_role', a.id as string)).toBe(false);
  });

  it("should replace a user's roles", async () => {
    const a = await roles.saveTenantRole(newRole('A role', []), ownerId);
    const b = await roles.saveTenantRole(newRole('B role', []), ownerId);
    await users.replaceRoles(ownerId, [a.id as string], ownerId);

    await users.replaceRoles(ownerId, [b.id as string], ownerId);

    expect(await roles.countHolders(a.id as string)).toBe(0);
    expect(await roles.countHolders(b.id as string)).toBe(1);
    expect((await users.findTenantUser(orgId, ownerId))?.email).toBe('owner@example.com');
  });
});
