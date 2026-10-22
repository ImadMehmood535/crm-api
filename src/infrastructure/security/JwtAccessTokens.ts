import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify } from 'jsonwebtoken';

import { AccessClaims, IAccessTokens } from './abstraction/IAccessTokens';

const ISSUER = 'crm-developer-api';
const AUDIENCE = 'crm-developer-ui';
const ALGORITHM = 'HS256';
const MIN_SECRET_LENGTH = 32;

/**
 * Short-lived HS256 access tokens. They only name the user and the session: roles, tenant and
 * status are resolved from the database on every request, so changes apply immediately.
 */
@Injectable()
export class JwtAccessTokens implements IAccessTokens {
  readonly ttlSeconds: number;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    if (this.secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
    }
    this.ttlSeconds = Number(config.get<string>('ACCESS_TOKEN_TTL_SECONDS', '900'));
  }

  sign(claims: AccessClaims): string {
    return sign({ sid: claims.sessionId }, this.secret, {
      algorithm: ALGORITHM,
      subject: claims.userId,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: this.ttlSeconds,
    });
  }

  verify(token: string): AccessClaims | null {
    try {
      const payload = verify(token, this.secret, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload === 'string') return null;
      const { sub, sid } = payload as { sub?: unknown; sid?: unknown };
      if (typeof sub !== 'string' || typeof sid !== 'string') return null;
      return { userId: sub, sessionId: sid };
    } catch {
      return null;
    }
  }
}
