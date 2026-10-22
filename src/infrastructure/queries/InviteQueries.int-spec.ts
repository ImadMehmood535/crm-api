import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createInvite, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { PlatformPersistenceModule } from '../persistence/PlatformPersistenceModule';
import { IInviteQueries, INVITE_QUERIES } from './abstraction/IInviteQueries';

describe('InviteQueries', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let queries: IInviteQueries;
  let ids: Record<string, string>;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([PlatformPersistenceModule]));
    queries = moduleRef.get(INVITE_QUERIES);
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    const invitedBy = await createUser(sequelize, { email: 'op@example.com' });
    const hour = 3_600_000;
    ids = {
      live: await createInvite(sequelize, {
        invitedBy,
        tokenHash: 'a'.repeat(64),
        createdAt: new Date(Date.now() - 3 * hour),
      }),
      expired: await createInvite(sequelize, {
        invitedBy,
        tokenHash: 'b'.repeat(64),
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(Date.now() - 2 * hour),
      }),
      revoked: await createInvite(sequelize, {
        invitedBy,
        status: 'revoked',
        createdAt: new Date(Date.now() - hour),
      }),
    };
  });

  afterAll(() => moduleRef.close());

  it('should list newest first with the derived expired status', async () => {
    const { rows, total } = await queries.findList({ page: 1, pageSize: 20 });

    expect(total).toBe(3);
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      [ids.revoked, 'revoked'],
      [ids.expired, 'expired'],
      [ids.live, 'pending'],
    ]);
  });

  it('should filter on the derived status', async () => {
    expect(
      (await queries.findList({ page: 1, pageSize: 20, status: 'expired' })).rows.map((r) => r.id),
    ).toEqual([ids.expired]);
    expect(
      (await queries.findList({ page: 1, pageSize: 20, status: 'pending' })).rows.map((r) => r.id),
    ).toEqual([ids.live]);
  });

  it('should preview only a live invite', async () => {
    expect(await queries.findLivePreview('a'.repeat(64))).toEqual({
      email: expect.any(String),
      firstName: 'Ali',
      lastName: 'Raza',
      organizationName: 'Harbor Homes',
      slug: expect.any(String),
      expiresAt: expect.stringMatching(/Z$/),
    });
    expect(await queries.findLivePreview('b'.repeat(64))).toBeNull();
  });
});
