import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createHierarchy } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { UserLevel } from '../../shared/auth/UserLevel';
import { TenantPersistenceModule } from '../persistence/TenantPersistenceModule';
import { ITenantUserQueries, TENANT_USER_QUERIES } from './abstraction/ITenantUserQueries';

describe('TenantUserQueries (hierarchy visibility)', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let queries: ITenantUserQueries;
  let h: Record<string, string>;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([TenantPersistenceModule]));
    queries = moduleRef.get(TENANT_USER_QUERIES);
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    h = await createHierarchy(sequelize);
  });
  afterAll(() => moduleRef.close());

  const seenBy = async (who: string, level: UserLevel): Promise<string[]> => {
    const { rows } = await queries.findList({
      organizationId: h.org,
      page: 1,
      pageSize: 100,
      viewer: { userId: h[who], level },
    });
    const names = Object.fromEntries(Object.entries(h).map(([k, v]) => [v, k]));
    return rows.map((r) => names[r.id]).sort();
  };

  it('should show the owner everyone', async () => {
    expect(await seenBy('owner', 'owner')).toEqual(
      ['admin1', 'admin2', 'head1', 'head2', 'member1', 'member2', 'member3', 'owner'].sort(),
    );
  });

  it("should show an admin the owner, all admins and the admins' people, not the owner's direct branch", async () => {
    expect(await seenBy('admin2', 'admin')).toEqual([
      'admin1',
      'admin2',
      'head1',
      'member1',
      'member2',
      'owner',
    ]);
  });

  it("should show a department head their own people and their departments' team members", async () => {
    expect(await seenBy('head1', 'department_head')).toEqual(['head1', 'member1', 'member2']);
    expect(await seenBy('head2', 'department_head')).toEqual(['head2', 'member3']);
  });

  it('should show a member themselves and their teammates', async () => {
    expect(await seenBy('member1', 'member')).toEqual(['member1', 'member2']);
    expect(await seenBy('member3', 'member')).toEqual(['member3']);
  });

  it('should hide users outside the viewer scope from findById, and expose level and teams', async () => {
    expect(await queries.findById(h.org, h.head2, { userId: h.admin1, level: 'admin' })).toBeNull();
    const member = await queries.findById(h.org, h.member1, {
      userId: h.head1,
      level: 'department_head',
    });
    expect(member).toMatchObject({
      level: 'member',
      teams: [{ id: h.payables, name: 'Payables' }],
    });
    const owner = await queries.findById(h.org, h.owner, { userId: h.owner, level: 'owner' });
    expect(owner).toMatchObject({ level: 'owner', isOwner: true, teams: [] });
  });
});
