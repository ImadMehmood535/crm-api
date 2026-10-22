import { ConfigService } from '@nestjs/config';

import { RefreshTokens } from './RefreshTokens';

describe('RefreshTokens', () => {
  const tokens = new RefreshTokens(new ConfigService({ REFRESH_TOKEN_TTL_DAYS: '30' }));

  it('should issue a random token with its SHA-256 and a 30-day expiry', () => {
    const before = Date.now();
    const issued = tokens.issue();

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.hash).toBe(tokens.hashOf(issued.token));
    expect(issued.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.expiresAt.getTime() - before).toBeGreaterThanOrEqual(30 * 24 * 3600 * 1000);
  });

  it('should never issue the same token twice', () => {
    expect(tokens.issue().token).not.toBe(tokens.issue().token);
  });
});
