import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createOrganization, createRole, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { uuidv7 } from '../../shared/utils/Uuid';
import { PlatformPersistenceModule } from '../persistence/PlatformPersistenceModule';
import { DEVELOPER_QUERIES, IDeveloperQueries } from './abstraction/IDeveloperQueries';

describe('DeveloperQueries', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let queries: IDeveloperQueries;
  let skylineId: string;
  let palmId: string;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([PlatformPersistenceModule]));
    queries = moduleRef.get(DEVELOPER_QUERIES);
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    skylineId = await createOrganization(sequelize, {
      name: 'Skyline Developers',
      slug: 'skyline',
    });
    const ownerRole = await createRole(sequelize, {
      code: 'developer_super_user',
      organizationId: skylineId,
    });
    await createUser(sequelize, {
      email: 'owner@skyline.example.com',
      organizationId: skylineId,
      firstName: 'Sara',
      lastName: 'Khan',
      roleIds: [ownerRole],
    });
    await createUser(sequelize, { email: 'staff@skyline.example.com', organizationId: skylineId });
    palmId = await createOrganization(sequelize, {
      name: 'Palm Estates',
      slug: 'palm',
      status: 'suspended',
    });
  });

  afterAll(() => moduleRef.close());

  it('should list newest first with user count and owner', async () => {
    const { rows, total } = await queries.findList({ page: 1, pageSize: 20 });

    expect(total).toBe(2);
    expect(rows.map((r) => r.id)).toEqual([palmId, skylineId]);
    expect(rows[1]).toEqual({
      id: skylineId,
      name: 'Skyline Developers',
      slug: 'skyline',
      status: 'active',
      createdAt: expect.stringMatching(/Z$/),
      userCount: 2,
      superUser: { id: expect.any(String), email: 'owner@skyline.example.com', name: 'Sara Khan' },
    });
    expect(rows[0].superUser).toBeNull();
    expect(rows[0].userCount).toBe(0);
  });

  it.each([['owner@skyline'], ['KHAN'], ['palm'], ['Developers']])(
    'should search name, slug and owner email or name: %s',
    async (search) => {
      const { rows } = await queries.findList({ page: 1, pageSize: 20, search });

      expect(rows).toHaveLength(1);
    },
  );

  it('should treat % in the search literally', async () => {
    expect((await queries.findList({ page: 1, pageSize: 20, search: '%' })).rows).toHaveLength(0);
  });

  it('should filter by status and paginate', async () => {
    const suspended = await queries.findList({ page: 1, pageSize: 20, status: 'suspended' });
    const second = await queries.findList({ page: 2, pageSize: 1 });

    expect(suspended.rows.map((r) => r.id)).toEqual([palmId]);
    expect(second.rows.map((r) => r.id)).toEqual([skylineId]);
    expect(second.total).toBe(2);
  });

  it('should find one by id or return null', async () => {
    expect((await queries.findById(skylineId))?.userCount).toBe(2);
    expect(await queries.findById(uuidv7())).toBeNull();
  });
});
