import {
  accessTokens,
  account,
  authQueries,
  sessionRepository,
} from '../../../../../../test/support/auth-mocks';
import { UnauthenticatedError } from '@shared/errors/AppError';

import { ResolveActorQuery } from './ResolveActorQuery';
import { ResolveActorQueryHandler } from './ResolveActorQueryHandler';

describe('ResolveActorQueryHandler', () => {
  const setup = (found: ReturnType<typeof account> | null = account()) => {
    const tokens = accessTokens();
    const sessions = sessionRepository();
    sessions.isFamilyActive.mockResolvedValue(true);
    return {
      handler: new ResolveActorQueryHandler(tokens, sessions, authQueries(found)),
      tokens,
      sessions,
    };
  };

  it('should turn a valid token into the Actor', async () => {
    const { handler, sessions } = setup();

    const result = await handler.execute(new ResolveActorQuery('token'));

    expect(sessions.isFamilyActive).toHaveBeenCalledWith('family-1', 'user-1');
    expect(result).toEqual({
      userId: 'user-1',
      sessionId: 'family-1',
      organizationId: 'org-1',
      plane: 'tenant',
      roles: ['developer_super_user'],
      permissions: [],
      isSuperUser: true,
      mustResetPassword: false,
      level: 'owner',
    });
  });

  it('should refuse a token that does not verify', async () => {
    const { handler, tokens } = setup();
    tokens.verify.mockReturnValue(null);

    await expect(handler.execute(new ResolveActorQuery('forged'))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('should refuse a token whose login chain was revoked', async () => {
    const { handler, sessions } = setup();
    sessions.isFamilyActive.mockResolvedValue(false);

    await expect(handler.execute(new ResolveActorQuery('token'))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('should refuse a user that no longer exists', async () => {
    const { handler } = setup(null);

    await expect(handler.execute(new ResolveActorQuery('token'))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('should refuse a suspended company on every request', async () => {
    const { handler } = setup(account({ organizationStatus: 'suspended' }));

    await expect(handler.execute(new ResolveActorQuery('token'))).rejects.toMatchObject({
      code: 'ORGANIZATION_SUSPENDED',
    });
  });

  it('should refuse an inactive user', async () => {
    const { handler } = setup(account({ userStatus: 'inactive' }));

    await expect(handler.execute(new ResolveActorQuery('token'))).rejects.toMatchObject({
      code: 'ACCOUNT_INACTIVE',
    });
  });

  it('should give a platform user no organization', async () => {
    const platform = account({ organizationStatus: null });
    platform.user.organization = null;
    platform.user.plane = 'platform';
    const { handler } = setup(platform);

    const result = await handler.execute(new ResolveActorQuery('token'));

    expect(result.organizationId).toBeNull();
    expect(result.plane).toBe('platform');
  });
});
