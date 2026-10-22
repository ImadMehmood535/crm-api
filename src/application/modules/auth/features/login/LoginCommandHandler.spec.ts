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
import { User } from '@domain/aggregates/UserAggregate/User';
import { ForbiddenError, UnauthenticatedError } from '@shared/errors/AppError';

import { SessionIssuer } from '../../SessionIssuer';
import { LoginCommand } from './LoginCommand';
import { LoginCommandHandler } from './LoginCommandHandler';

describe('LoginCommandHandler', () => {
  const setup = (found = account()) => {
    const users = userRepository();
    users.findByEmail.mockResolvedValue(
      User.rehydrate('user-1', 'org-1', 'owner@example.com', 'active'),
    );
    users.findCredential.mockResolvedValue({ passwordHash: 'stored', mustResetPassword: false });
    const hasher = passwordHasher();
    const sessions = sessionRepository();
    const issuer = new SessionIssuer(sessions, refreshTokens(), accessTokens());
    const handler = new LoginCommandHandler(users, authQueries(found), hasher, issuer);
    return { handler, users, hasher, sessions };
  };

  it('should return an AuthSession and stamp the login', async () => {
    const { handler, users, sessions } = setup();

    const result = await handler.execute(
      new LoginCommand('owner@example.com', 'Correct-Password-123', META),
    );

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'new-refresh',
      expiresIn: 900,
      user: account().user,
    });
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        refreshTokenHash: 'new-hash',
        ipAddress: '10.0.0.1',
      }),
      undefined,
    );
    expect(users.markLoggedIn).toHaveBeenCalledWith('user-1');
  });

  it('should answer INVALID_CREDENTIALS for an unknown email after a dummy hash check', async () => {
    const { handler, users, hasher } = setup();
    users.findByEmail.mockResolvedValue(null);

    const act = handler.execute(new LoginCommand('nobody@example.com', 'whatever-password', META));

    await expect(act).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(act).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    expect(hasher.dummyVerify).toHaveBeenCalled();
  });

  it('should answer INVALID_CREDENTIALS for a wrong password', async () => {
    const { handler } = setup();

    await expect(
      handler.execute(new LoginCommand('owner@example.com', 'Wrong-Password-123', META)),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('should hide a suspended company behind a wrong password', async () => {
    const { handler } = setup(account({ organizationStatus: 'suspended' }));

    await expect(
      handler.execute(new LoginCommand('owner@example.com', 'Wrong-Password-123', META)),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('should reveal ORGANIZATION_SUSPENDED only after a correct password', async () => {
    const { handler, sessions } = setup(account({ organizationStatus: 'suspended' }));

    const act = handler.execute(
      new LoginCommand('owner@example.com', 'Correct-Password-123', META),
    );

    await expect(act).rejects.toBeInstanceOf(ForbiddenError);
    await expect(act).rejects.toMatchObject({ code: 'ORGANIZATION_SUSPENDED' });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('should answer ACCOUNT_INACTIVE for an inactive user', async () => {
    const { handler } = setup(account({ userStatus: 'inactive' }));

    await expect(
      handler.execute(new LoginCommand('owner@example.com', 'Correct-Password-123', META)),
    ).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
  });
});
