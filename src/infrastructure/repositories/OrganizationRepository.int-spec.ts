import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { persistenceModule } from '../../../test/support/persistence';
import { Organization } from '../../domain/aggregates/OrganizationAggregate/Organization';
import { PlatformPersistenceModule } from '../persistence/PlatformPersistenceModule';
import {
  IOrganizationRepository,
  ORGANIZATION_REPOSITORY,
} from './abstraction/IOrganizationRepository';
import { IRoleRepository, ROLE_REPOSITORY } from './abstraction/IRoleRepository';

describe('OrganizationRepository / RoleRepository', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let organizations: IOrganizationRepository;
  let roles: IRoleRepository;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([PlatformPersistenceModule]));
    organizations = moduleRef.get(ORGANIZATION_REPOSITORY);
    roles = moduleRef.get(ROLE_REPOSITORY);
  });
  beforeEach(() => truncateAll(sequelize));
  afterAll(() => moduleRef.close());

  it('should save a company, find it, persist a status change and report its slug as taken', async () => {
    const saved = await organizations.save(
      Organization.create({ name: 'Palm', slug: 'palm', createdBy: null }),
    );

    saved.suspend();
    await organizations.update(saved);

    const found = await organizations.findById(saved.id as string);
    expect(found?.status).toBe('suspended');
    expect(await organizations.slugExists('PALM')).toBe(true);
    expect(await organizations.slugExists('other')).toBe(false);
  });

  it('should create the owner role and find platform roles by code', async () => {
    const organization = await organizations.save(
      Organization.create({ name: 'Palm', slug: 'palm', createdBy: null }),
    );
    await sequelize.query(
      `INSERT INTO roles (id, organization_id, code, name, is_system_role) VALUES (gen_random_uuid(), NULL, 'platform_admin', 'Platform Admin', true)`,
    );

    const roleId = await roles.createOwnerRole(organization.id as string);

    const [rows] = await sequelize.query(
      'SELECT code, is_system_role FROM roles WHERE id = :roleId',
      {
        replacements: { roleId },
      },
    );
    expect(rows).toEqual([{ code: 'developer_super_user', is_system_role: true }]);
    expect(await roles.findPlatformRoleId('platform_admin')).toEqual(expect.any(String));
    expect(await roles.findPlatformRoleId('nope')).toBeNull();
  });
});
