import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createOrganization, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { AUDIT_LOG, IAuditLog } from '../audit/abstraction/IAuditLog';
import { CommonInfrastructureModule } from '../persistence/CommonInfrastructureModule';
import { PlatformPersistenceModule } from '../persistence/PlatformPersistenceModule';
import { AUDIT_QUERIES, IAuditQueries } from './abstraction/IAuditQueries';
import { IPlatformStatsQueries, PLATFORM_STATS_QUERIES } from './abstraction/IPlatformStatsQueries';

describe('PlatformStatsQueries / AuditQueries', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let stats: IPlatformStatsQueries;
  let auditQueries: IAuditQueries;
  let audit: IAuditLog;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([
      PlatformPersistenceModule,
      CommonInfrastructureModule,
    ]));
    stats = moduleRef.get(PLATFORM_STATS_QUERIES);
    auditQueries = moduleRef.get(AUDIT_QUERIES);
    audit = moduleRef.get(AUDIT_LOG);
  });
  beforeEach(() => truncateAll(sequelize));
  afterAll(() => moduleRef.close());

  it('should count companies, tenant users and this week in the trend', async () => {
    const a = await createOrganization(sequelize);
    await createOrganization(sequelize);
    await createOrganization(sequelize, { status: 'suspended' });
    await createUser(sequelize, { email: 'op@example.com' });
    await createUser(sequelize, { email: 't1@example.com', organizationId: a });
    await createUser(sequelize, { email: 't2@example.com', organizationId: a });

    const result = await stats.getStats(8);

    expect(result.counts).toEqual({
      organizations: { total: 3, active: 2, suspended: 1 },
      users: { total: 2 },
      projects: { total: 0 },
      units: { total: 0 },
    });
    expect(result.trends.weeks).toHaveLength(8);
    const weekStarts = result.trends.weeks.map((w) => w.weekStart);
    expect([...weekStarts].sort()).toEqual(weekStarts);
    expect(new Date(`${weekStarts[7]}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(result.trends.weeks[7]).toMatchObject({ newOrganizations: 3, newUsers: 2 });
  });

  it('should map audit actions to company activity, newest first, with the actor name', async () => {
    const org = await createOrganization(sequelize, { name: 'Palm' });
    const op = await createUser(sequelize, {
      email: 'op@example.com',
      firstName: 'Ops',
      lastName: 'Lead',
    });
    const base = { entityType: 'organization', entityId: org, organizationId: org, ip: null };
    await audit.record({ ...base, actorUserId: op, action: 'developer.onboarded' });
    await audit.record({ ...base, actorUserId: op, action: 'developer.suspended' });
    await audit.record({ ...base, actorUserId: null, action: 'invite.accepted' });

    const result = await stats.getStats(1);

    expect(result.recentActivity.map((a) => [a.type, a.actorName])).toEqual([
      ['organization.created', null],
      ['organization.suspended', 'Ops Lead'],
      ['organization.created', 'Ops Lead'],
    ]);
    expect(result.recentActivity[0]).toMatchObject({
      organizationId: org,
      organizationName: 'Palm',
    });
  });

  it('should list audit entries filtered by action with actor and company', async () => {
    const org = await createOrganization(sequelize, { name: 'Palm' });
    const op = await createUser(sequelize, {
      email: 'op@example.com',
      firstName: 'Ops',
      lastName: 'Lead',
    });
    const base = { entityType: 'organization', entityId: org, organizationId: org, ip: '10.0.0.9' };
    await audit.record({ ...base, actorUserId: op, action: 'developer.onboarded' });
    await audit.record({
      ...base,
      actorUserId: op,
      action: 'developer.suspended',
      oldValues: { status: 'active' },
      newValues: { status: 'suspended' },
    });

    const { rows, total } = await auditQueries.findList({
      page: 1,
      pageSize: 20,
      action: 'developer.suspended',
    });

    expect(total).toBe(1);
    expect(rows[0]).toEqual({
      id: expect.any(String),
      createdAt: expect.stringMatching(/Z$/),
      action: 'developer.suspended',
      entityType: 'organization',
      entityId: org,
      organizationId: org,
      organizationName: 'Palm',
      actor: { id: op, email: 'op@example.com', name: 'Ops Lead' },
      oldValues: { status: 'active' },
      newValues: { status: 'suspended' },
      ip: '10.0.0.9',
    });
    expect(
      (await auditQueries.findList({ page: 1, pageSize: 20, organizationId: org })).total,
    ).toBe(2);
  });
});
