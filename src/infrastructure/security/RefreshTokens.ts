import { createHash, randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IRefreshTokens, IssuedRefreshToken } from './abstraction/IRefreshTokens';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Opaque 256-bit tokens. Stored as SHA-256: high entropy makes a fast hash the right tool. */
@Injectable()
export class RefreshTokens implements IRefreshTokens {
  private readonly ttlMs: number;

  constructor(config: ConfigService) {
    this.ttlMs = Number(config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30')) * DAY_MS;
  }

  issue(): IssuedRefreshToken {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashOf(token), expiresAt: new Date(Date.now() + this.ttlMs) };
  }

  hashOf(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
