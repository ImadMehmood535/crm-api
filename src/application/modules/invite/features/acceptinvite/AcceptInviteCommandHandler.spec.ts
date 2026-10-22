import {
  META,
  accessTokens,
  account,
  authQueries,
  passwordHasher,
  refreshTokens,
  sessionRepository,
  userRepository,
} from '../../../../../../test/support/auth-mocks';
import {
  auditLog,
  inviteRepository,
  organizationRepository,
  pendingInvite,
  roleRepository,
  unitOfWork,
} from '../../../../../../test/support/platform-mocks';
import { User } from '@domain/aggregates/UserAggregate/User';
import { SessionIssuer } from '@application/modules/auth/SessionIssuer';

import { AcceptInviteCommand } from './AcceptInviteCommand';
import { AcceptInviteCommandHandler } from './AcceptInviteCommandHandler';

describe('AcceptInviteCommandHandler', () => {
  const setup = () => {
    const invites = inviteRepository();
    invites.findByTokenHash.mockResolvedValue(pendingInvite());
    const organizations = organizationRepository();
    const users = userRepository();
    users.save.mockImplementation((u: User) =>
      Promise.resolve(
        User.rehydrate(
          'owner-1',
          u.organizationId,
          u.email,
          u.firstName,
          u.lastName,
          u.status,
          null,
        ),
      ),
    );
    const audit = auditLog();
    const sessions = sessionRepository();
    const handler = new AcceptInviteCommandHandler(
      invites,
      organizations,
      users,
      roleRepository(),
      authQueries(account()),
      passwordHasher(),
      audit,
      unitOfWork,
      new SessionIssuer(sessions, refreshTokens(), accessTokens()),
    );
    return { handler, invites, organizations, users, audit, sessions };
  };

  it('should create the company and owner (no reset needed), accept the invite and sign in', async () => {
    const { handler, organizations, users, invites, audit, sessions } = setup();

    const session = await handler.execute(
      new AcceptInviteCommand(
        'raw-token',
        { password: 'Harbor-Password-1', firstName: 'Alia' },
        META,
      ),
    );

    expect(organizations.save.mock.calls[0][0]).toMatchObject({
      name: 'Harbor Homes',
      slug: 'harbor-homes',
    });
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Alia', lastName: 'Raza' }),
      'hashed',
      false,
      {},
    );
    expect(invites.update.mock.calls[0][0].status).toBe('accepted');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'invite.accepted',
        actorUserId: null,
        organizationId: 'org-1',
      }),
      {},
    );
    expect(sessions.create).toHaveBeenCalled();
    expect(session.refreshToken).toBe('new-refresh');
  });

  it('should answer INVITE_INVALID for an unknown token', async () => {
    const { handler, invites } = setup();
    invites.findByTokenHash.mockResolvedValue(null);

    await expect(
      handler.execute(new AcceptInviteCommand('nope', { password: 'Harbor-Password-1' }, META)),
    ).rejects.toMatchObject({ status: 404, code: 'INVITE_INVALID' });
  });

  it.each(['SLUG_CONFLICT', 'EMAIL_CONFLICT'])(
    'should answer %s when taken since the invite',
    async (code) => {
      const { handler, organizations, users } = setup();
      if (code === 'SLUG_CONFLICT') organizations.slugExists.mockResolvedValue(true);
      else users.emailExists.mockResolvedValue(true);

      await expect(
        handler.execute(new AcceptInviteCommand('raw', { password: 'Harbor-Password-1' }, META)),
      ).rejects.toMatchObject({ status: 409, code });
    },
  );
});
