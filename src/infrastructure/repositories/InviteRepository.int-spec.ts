import { TestingModule } from '@nestjs/testing';
import { Sequelize } from 'sequelize-typescript';

import { truncateAll } from '../../../test/support/db';
import { createInvite, createUser } from '../../../test/support/fixtures';
import { persistenceModule } from '../../../test/support/persistence';
import { Invite } from '../../domain/aggregates/InviteAggregate/Invite';
import { PlatformPersistenceModule } from '../persistence/PlatformPersistenceModule';
import { IInviteRepository, INVITE_REPOSITORY } from './abstraction/IInviteRepository';

describe('InviteRepository', () => {
  let moduleRef: TestingModule;
  let sequelize: Sequelize;
  let invites: IInviteRepository;
  let operatorId: string;

  beforeAll(async () => {
    ({ moduleRef, sequelize } = await persistenceModule([PlatformPersistenceModule]));
    invites = moduleRef.get(INVITE_REPOSITORY);
  });
  beforeEach(async () => {
    await truncateAll(sequelize);
    operatorId = await createUser(sequelize, { email: 'op@example.com' });
  });
  afterAll(() => moduleRef.close());

  it('should save an invite, find it by token hash and persist a revoke', async () => {
    const saved = await invites.save(
      Invite.issue({
        email: 'new@dev.example.com',
        firstName: 'Ali',
        lastName: 'Raza',
        organizationName: 'Harbor Homes',
        slug: 'harbor-homes',
        tokenHash: 'a'.repeat(64),
        invitedBy: operatorId,
      }),
    );

    saved.revoke();
    await invites.update(saved);

    const found = await invites.findByTokenHash('a'.repeat(64));
    expect(found?.id).toBe(saved.id);
    expect(found?.status).toBe('revoked');
  });

  it('should count only live pending invites for email and slug checks', async () => {
    await createInvite(sequelize, { invitedBy: operatorId, email: 'live@x.com', slug: 'live' });
    await createInvite(sequelize, {
      invitedBy: operatorId,
      email: 'old@x.com',
      slug: 'old',
      expiresAt: new Date(Date.now() - 1000),
    });
    await createInvite(sequelize, {
      invitedBy: operatorId,
      email: 'done@x.com',
      slug: 'done',
      status: 'accepted',
    });

    expect(await invites.livePendingEmailExists('LIVE@x.com')).toBe(true);
    expect(await invites.livePendingEmailExists('old@x.com')).toBe(false);
    expect(await invites.livePendingEmailExists('done@x.com')).toBe(false);
    expect(await invites.livePendingSlugExists('live')).toBe(true);
    expect(await invites.livePendingSlugExists('old')).toBe(false);
  });

  it('should ignore the given invite when checking its own slug', async () => {
    const id = await createInvite(sequelize, { invitedBy: operatorId, slug: 'mine' });

    expect(await invites.livePendingSlugExists('mine', id)).toBe(false);
  });
});
