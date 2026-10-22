import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { UnauthenticatedError } from '@shared/errors/AppError';
import { AUTH_QUERIES, IAuthQueries } from '@infrastructure/queries/abstraction/IAuthQueries';
import {
  ISessionRepository,
  SESSION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ISessionRepository';
import {
  IRefreshTokens,
  REFRESH_TOKENS,
} from '@infrastructure/security/abstraction/IRefreshTokens';

import { assertCanAuthenticate } from '../../AccessPolicy';
import { SessionIssuer } from '../../SessionIssuer';
import { AuthSessionResponse } from '../login/AuthSessionResponse';
import { RefreshCommand } from './RefreshCommand';

/** Single-use, rotating refresh tokens. Replaying a rotated token revokes the whole login chain. */
@CommandHandler(RefreshCommand)
export class RefreshCommandHandler implements ICommandHandler<RefreshCommand, AuthSessionResponse> {
  private readonly logger = new Logger(RefreshCommandHandler.name);

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(REFRESH_TOKENS) private readonly refreshTokens: IRefreshTokens,
    @Inject(AUTH_QUERIES) private readonly authQueries: IAuthQueries,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async execute(command: RefreshCommand): Promise<AuthSessionResponse> {
    const session = await this.sessions.findByTokenHash(
      this.refreshTokens.hashOf(command.refreshToken),
    );
    if (!session) throw new UnauthenticatedError();
    if (session.isRotated()) return this.rejectReuse(session.familyId, session.userId);
    if (!session.isActive()) throw new UnauthenticatedError();

    const account = await this.authQueries.findAccount(session.userId);
    if (!account) throw new UnauthenticatedError();
    // Refused, but the session is kept: reactivating the company restores access.
    assertCanAuthenticate(account.userStatus, account.organizationStatus);

    const issued = this.refreshTokens.issue();
    const next = await this.sessions.rotate(
      session.id,
      this.sessionIssuer.newSession(session.userId, session.familyId, issued, command.meta),
    );
    // A concurrent refresh consumed the same token first: that is reuse too.
    if (!next) return this.rejectReuse(session.familyId, session.userId);
    return this.sessionIssuer.respond(account.user, session.familyId, issued.token);
  }

  private async rejectReuse(familyId: string, userId: string): Promise<never> {
    await this.sessions.revokeFamily(familyId, 'refresh_reuse');
    this.logger.warn(`Refresh token reuse for user ${userId}; login chain revoked`);
    throw new UnauthenticatedError();
  }
}
