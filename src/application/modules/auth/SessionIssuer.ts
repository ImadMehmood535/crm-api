import { Inject, Injectable } from '@nestjs/common';

import { RequestMeta } from '@shared/auth/Actor';
import { uuidv7 } from '@shared/utils/Uuid';
import { AuthUserReadModel } from '@infrastructure/queries/abstraction/IAuthQueries';
import {
  ISessionRepository,
  NewSession,
  SESSION_REPOSITORY,
} from '@infrastructure/repositories/abstraction/ISessionRepository';
import { ACCESS_TOKENS, IAccessTokens } from '@infrastructure/security/abstraction/IAccessTokens';
import {
  IRefreshTokens,
  IssuedRefreshToken,
  REFRESH_TOKENS,
} from '@infrastructure/security/abstraction/IRefreshTokens';
import { Tx } from '@infrastructure/persistence/abstraction/IUnitOfWork';

import { AuthUserResponse } from './features/getme/AuthUserResponse';
import { AuthSessionResponse } from './features/login/AuthSessionResponse';

const IP_MAX = 64;
const USER_AGENT_MAX = 255;

/** Opens login chains and turns a session into the `AuthSession` the frontend expects. */
@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    @Inject(REFRESH_TOKENS) private readonly refreshTokens: IRefreshTokens,
    @Inject(ACCESS_TOKENS) private readonly accessTokens: IAccessTokens,
  ) {}

  /** Starts a new login chain for `user`. */
  async start(user: AuthUserReadModel, meta: RequestMeta, tx?: Tx): Promise<AuthSessionResponse> {
    const issued = this.refreshTokens.issue();
    const session = await this.sessions.create(
      this.newSession(user.id, uuidv7(), issued, meta),
      tx,
    );
    return this.respond(user, session.familyId, issued.token);
  }

  newSession(
    userId: string,
    familyId: string,
    issued: IssuedRefreshToken,
    meta: RequestMeta,
  ): NewSession {
    return {
      userId,
      familyId,
      refreshTokenHash: issued.hash,
      expiresAt: issued.expiresAt,
      ipAddress: meta.ipAddress?.slice(0, IP_MAX) ?? null,
      userAgent: meta.userAgent?.slice(0, USER_AGENT_MAX) ?? null,
    };
  }

  respond(user: AuthUserReadModel, familyId: string, refreshToken: string): AuthSessionResponse {
    const accessToken = this.accessTokens.sign({ userId: user.id, sessionId: familyId });
    return AuthSessionResponse.of(
      accessToken,
      refreshToken,
      this.accessTokens.ttlSeconds,
      AuthUserResponse.from(user),
    );
  }
}
