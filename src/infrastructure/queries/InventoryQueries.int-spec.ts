import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createOrganization } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { Project } from '../../domain/aggregates/ProjectAggregate/Project';
import { Unit } from '../../domain/aggregates/UnitAggregate/Unit';
import { CommonInfrastructureModule } from '../persistence/CommonInfrastructureModule';
import { InventoryPersistenceModule } from '../persistence/InventoryPersistenceModule';
import { PlatformPersistenceModule } from '../persistence/PlatformPersistenceModule';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../repositories/abstraction/IProjectRepository';
import { IUnitRepository, UNIT_REPOSITORY } from '../repositories/abstraction/IUnitRepository';
import { IInventoryQueries, INVENTORY_QUERIES } from './abstraction/IInventoryQueries';
import { IPlatformStatsQueries, PLATFORM_STATS_QUERIES } from './abstraction/IPlatformStatsQueries';

describe('Inventory persistence', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let projects: IProjectRepository;
  let units: IUnitRepository;
  let queries: IInventoryQueries;
  let stats: IPlatformStatsQueries;
  let orgId: string;

  const project = (name: string, city: string | null = null) =>
    Project.create({
      organizationId: orgId,
      name,
      description: null,
      city,
      address: null,
      currency: null,
      status: null,
      expectedCompletion: '2027-06-30',
      createdBy: null,
    });
  const unit = (
    projectId: string,
    number: string,
    status: string | null = null,
    price: number | null = null,
  ) =>
    Unit.create({
      organizationId: orgId,
      projectId,
      number,
      type: null,
      status,
      bedrooms: null,
      bathrooms: null,
      floor: null,
      areaSqm: 120.5,
      price,
      notes: null,
      createdBy: null,
    });

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([
      InventoryPersistenceModule,
      PlatformPersistenceModule,
      CommonInfrastructureModule,
    ]));
    projects = moduleRef.get(PROJECT_REPOSITORY);
    units = moduleRef.get(UNIT_REPOSITORY);
    queries = moduleRef.get(INVENTORY_QUERIES);
    stats = moduleRef.get(PLATFORM_STATS_QUERIES);
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    orgId = await createOrganization(sequelize);
  });
  afterAll(() => moduleRef.close());

  it('should list projects newest first with unit counts, search and status', async () => {
    const palm = await projects.save(project('Palm Heights', 'Lahore'));
    const sky = await projects.save(project('Sky Towers', 'Karachi'));
    await units.save(unit(palm.id as string, 'A-1'));
    await units.save(unit(palm.id as string, 'A-2', 'sold'));

    const { rows, total } = await queries.findProjects({
      organizationId: orgId,
      page: 1,
      pageSize: 20,
    });

    expect(total).toBe(2);
    expect(rows.map((r) => r.id)).toEqual([sky.id, palm.id]);
    expect(rows[1]).toMatchObject({
      currency: 'USD',
      status: 'planning',
      expectedCompletion: '2027-06-30',
      unitCounts: { total: 2, available: 1, reserved: 0, sold: 1, blocked: 0 },
    });
    expect(
      (
        await queries.findProjects({
          organizationId: orgId,
          page: 1,
          pageSize: 20,
          search: 'LAHORE',
        })
      ).total,
    ).toBe(1);
    expect(
      (
        await queries.findProjects({
          organizationId: orgId,
          page: 1,
          pageSize: 20,
          status: 'active',
        })
      ).total,
    ).toBe(0);
  });

  it('should compare project names ignoring case and spaces, and keep companies apart', async () => {
    const saved = await projects.save(project('Palm Heights'));
    const other = await createOrganization(sequelize);

    expect(await projects.nameKeyExists(orgId, 'palm heights')).toBe(true);
    expect(await projects.nameKeyExists(orgId, 'palm heights', saved.id as string)).toBe(false);
    expect(await projects.findById(other, saved.id as string)).toBeNull();
    expect(await queries.findProject(other, saved.id as string)).toBeNull();
  });

  it('should list units in natural order with numbers as numbers', async () => {
    const palm = await projects.save(project('Palm Heights'));
    for (const n of ['A-10', 'A-2', 'A-1'])
      await units.save(unit(palm.id as string, n, null, 250000.5));

    const { rows } = await queries.findUnits({
      organizationId: orgId,
      projectId: palm.id as string,
      page: 1,
      pageSize: 20,
    });

    expect(rows.map((u) => u.number)).toEqual(['A-1', 'A-2', 'A-10']);
    expect(rows[0]).toMatchObject({
      price: 250000.5,
      areaSqm: 120.5,
      type: 'apartment',
      status: 'available',
    });
    expect(await units.numberKeyExists(palm.id as string, 'a-1')).toBe(true);
    expect(await projects.hasUnits(palm.id as string)).toBe(true);
  });

  it('should refuse a unit pointing at another company project (composite FK)', async () => {
    const other = await createOrganization(sequelize);
    const foreign = await projects.save(
      Project.create({
        organizationId: other,
        name: 'Theirs',
        description: null,
        city: null,
        address: null,
        currency: null,
        status: null,
        expectedCompletion: null,
        createdBy: null,
      }),
    );

    await expect(units.save(unit(foreign.id as string, 'X-1'))).rejects.toThrow();
  });

  it('should update and delete, and count inventory in platform stats', async () => {
    const palm = await projects.save(project('Palm Heights'));
    const a1 = await units.save(unit(palm.id as string, 'A-1'));
    a1.changeStatus('reserved');
    await units.update(a1);
    expect((await queries.findUnit(orgId, a1.id as string))?.status).toBe('reserved');

    expect((await stats.getStats(1)).counts).toMatchObject({
      projects: { total: 1 },
      units: { total: 1 },
    });

    await units.delete(a1.id as string);
    await projects.delete(palm.id as string);
    expect(await queries.findProject(orgId, palm.id as string)).toBeNull();
  });
});
