import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createOrganization, createRole, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { uuidv7 } from '../../shared/utils/Uuid';
import { AuthPersistenceModule } from '../persistence/AuthPersistenceModule';
import { AUTH_QUERIES, IAuthQueries } from './abstraction/IAuthQueries';

describe('AuthQueries', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let queries: IAuthQueries;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([AuthPersistenceModule]));
    queries = moduleRef.get(AUTH_QUERIES);
  });

  beforeEach(() => truncateAll(sequelize));
  afterAll(() => moduleRef.close());

  it('should describe a platform super user', async () => {
    const roleId = await createRole(sequelize, { code: 'platform_super_user', isSystemRole: true });
    const id = await createUser(sequelize, { email: 'p@example.com', roleIds: [roleId] });

    const account = await queries.findAccount(id);

    expect(account).toEqual({
      userStatus: 'active',
      organizationStatus: null,
      user: {
        id,
        email: 'p@example.com',
        firstName: 'Test',
        lastName: 'User',
        plane: 'platform',
        roles: ['platform_super_user'],
        isSuperUser: true,
        organization: null,
        mustResetPassword: false,
        permissions: [],
      },
    });
  });

  it('should describe a tenant user with their company and only active roles', async () => {
    const orgId = await createOrganization(sequelize, {
      name: 'Skyline',
      slug: 'skyline',
      status: 'suspended',
    });
    const active = await createRole(sequelize, { code: 'sales', organizationId: orgId });
    const inactive = await createRole(sequelize, {
      code: 'old',
      organizationId: orgId,
      isActive: false,
    });
    const id = await createUser(sequelize, {
      email: 't@example.com',
      organizationId: orgId,
      mustReset: true,
      roleIds: [active, inactive],
    });

    const account = await queries.findAccount(id);

    expect(account?.organizationStatus).toBe('suspended');
    expect(account?.user.plane).toBe('tenant');
    expect(account?.user.organization).toEqual({
      id: orgId,
      name: 'Skyline',
      slug: 'skyline',
      status: 'suspended',
    });
    expect(account?.user.roles).toEqual(['sales']);
    expect(account?.user.isSuperUser).toBe(false);
    expect(account?.user.mustResetPassword).toBe(true);
  });

  it('should return null for an unknown user', async () => {
    expect(await queries.findAccount(uuidv7())).toBeNull();
  });
});
