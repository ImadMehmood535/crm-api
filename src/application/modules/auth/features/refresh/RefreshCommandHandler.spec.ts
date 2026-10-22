import { Logger } from '@nestjs/common';

import {
  META,
  accessTokens,
  account,
  activeSession,
  authQueries,
  refreshTokens,
  rotatedSession,
  sessionRepository,
} from '../../../../../../test/support/auth-mocks';
import { Session } from '@domain/aggregates/SessionAggregate/Session';
import { UnauthenticatedError } from '@shared/errors/AppError';

import { SessionIssuer } from '../../SessionIssuer';
import { RefreshCommand } from './RefreshCommand';
import { RefreshCommandHandler } from './RefreshCommandHandler';

describe('RefreshCommandHandler', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));

  const setup = (found = account()) => {
    const sessions = sessionRepository();
    const tokens = refreshTokens();
    const handler = new RefreshCommandHandler(
      sessions,
      tokens,
      authQueries(found),
      new SessionIssuer(sessions, tokens, accessTokens()),
    );
    return { handler, sessions };
  };

  it('should rotate the session and return a new AuthSession in the same chain', async () => {
    const { handler, sessions } = setup();
    sessions.findByTokenHash.mockResolvedValue(activeSession());
    sessions.rotate.mockResolvedValue(
      Session.rehydrate('s-2', 'user-1', 'family-1', new Date(), null, null),
    );

    const result = await handler.execute(new RefreshCommand('old-refresh', META));

    expect(sessions.findByTokenHash).toHaveBeenCalledWith('hash-of-old-refresh');
    expect(sessions.rotate).toHaveBeenCalledWith(
      's-1',
      expect.objectContaining({ familyId: 'family-1', refreshTokenHash: 'new-hash' }),
    );
    expect(result.refreshToken).toBe('new-refresh');
  });

  it('should answer UNAUTHENTICATED for an unknown token', async () => {
    const { handler, sessions } = setup();
    sessions.findByTokenHash.mockResolvedValue(null);

    await expect(handler.execute(new RefreshCommand('nope', META))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('should answer UNAUTHENTICATED for an expired token', async () => {
    const { handler, sessions } = setup();
    sessions.findByTokenHash.mockResolvedValue(
      Session.rehydrate('s-1', 'user-1', 'family-1', new Date(Date.now() - 1000), null, null),
    );

    await expect(handler.execute(new RefreshCommand('old', META))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
  });

  it('should revoke the whole chain when a rotated token is replayed', async () => {
    const { handler, sessions } = setup();
    sessions.findByTokenHash.mockResolvedValue(rotatedSession());

    await expect(handler.execute(new RefreshCommand('stolen', META))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(sessions.revokeFamily).toHaveBeenCalledWith('family-1', 'refresh_reuse');
  });

  it('should treat losing a concurrent rotation as reuse', async () => {
    const { handler, sessions } = setup();
    sessions.findByTokenHash.mockResolvedValue(activeSession());
    sessions.rotate.mockResolvedValue(null);

    await expect(handler.execute(new RefreshCommand('old', META))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(sessions.revokeFamily).toHaveBeenCalledWith('family-1', 'refresh_reuse');
  });

  it('should refuse a suspended company and keep the session', async () => {
    const { handler, sessions } = setup(account({ organizationStatus: 'suspended' }));
    sessions.findByTokenHash.mockResolvedValue(activeSession());

    await expect(handler.execute(new RefreshCommand('old', META))).rejects.toMatchObject({
      code: 'ORGANIZATION_SUSPENDED',
    });
    expect(sessions.rotate).not.toHaveBeenCalled();
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
  });
});
