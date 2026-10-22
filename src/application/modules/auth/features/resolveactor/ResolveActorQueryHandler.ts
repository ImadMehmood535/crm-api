import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { Actor } from '@shared/auth/Actor';
import { UnauthenticatedError } from '@shared/errors/AppError';
import { AUTH_QUERIES, IAuthQueries } from '@infrastructure/queries/abstraction/IAuthQueries';
import {
  ISessionRepository,
  SESSION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ISessionRepository';
import { ACCESS_TOKENS, IAccessTokens } from '@infrastructure/security/abstraction/IAccessTokens';

import { assertCanAuthenticate } from '../../AccessPolicy';
import { ResolveActorQuery } from './ResolveActorQuery';

/** Token → caller. The token only names a login chain; whether it may act NOW is decided here. */
@QueryHandler(ResolveActorQuery)
export class ResolveActorQueryHandler implements IQueryHandler<ResolveActorQuery, Actor> {
  constructor(
    @Inject(ACCESS_TOKENS) private readonly accessTokens: IAccessTokens,
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(AUTH_QUERIES) private readonly authQueries: IAuthQueries,
  ) {}

  async execute(query: ResolveActorQuery): Promise<Actor> {
    const claims = this.accessTokens.verify(query.accessToken);
    if (!claims) throw new UnauthenticatedError();
    if (!(await this.sessions.isFamilyActive(claims.sessionId, claims.userId))) {
      throw new UnauthenticatedError();
    }
    const account = await this.authQueries.findAccount(claims.userId);
    if (!account) throw new UnauthenticatedError();
    // Re-checked on every request: suspension locks users out even with an unexpired token.
    assertCanAuthenticate(account.userStatus, account.organizationStatus);

    const { user } = account;
    return {
      userId: user.id,
      sessionId: claims.sessionId,
      organizationId: user.organization?.id ?? null,
      plane: user.plane,
      roles: user.roles,
      permissions: user.permissions,
      isSuperUser: user.isSuperUser,
      mustResetPassword: user.mustResetPassword,
    };
  }
}
