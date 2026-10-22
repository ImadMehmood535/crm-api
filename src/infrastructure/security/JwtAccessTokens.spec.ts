import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';

import { JwtAccessTokens } from './JwtAccessTokens';

const SECRET = 'a-test-secret-that-is-at-least-32-characters-long';
const config = (values: Record<string, string>): ConfigService =>
  new ConfigService({ JWT_ACCESS_SECRET: SECRET, ACCESS_TOKEN_TTL_SECONDS: '900', ...values });

describe('JwtAccessTokens', () => {
  const tokens = new JwtAccessTokens(config({}));

  it('should verify the claims of a token it signed', () => {
    const token = tokens.sign({ userId: 'u1', sessionId: 's1' });

    expect(tokens.verify(token)).toEqual({ userId: 'u1', sessionId: 's1' });
    expect(tokens.ttlSeconds).toBe(900);
  });

  it('should reject an expired token', () => {
    const shortLived = new JwtAccessTokens(config({ ACCESS_TOKEN_TTL_SECONDS: '-10' }));

    expect(tokens.verify(shortLived.sign({ userId: 'u1', sessionId: 's1' }))).toBeNull();
  });

  it('should reject a tampered token', () => {
    const token = tokens.sign({ userId: 'u1', sessionId: 's1' });
    const tampered = `${token.slice(0, -2)}xx`;

    expect(tokens.verify(tampered)).toBeNull();
  });

  it('should reject an unsigned token (alg none)', () => {
    const unsigned = sign({ sid: 's1' }, '', {
      algorithm: 'none',
      subject: 'u1',
      issuer: 'crm-developer-api',
      audience: 'crm-developer-ui',
    });

    expect(tokens.verify(unsigned)).toBeNull();
  });

  it('should reject a token for another audience', () => {
    const foreign = sign({ sid: 's1' }, SECRET, {
      subject: 'u1',
      issuer: 'crm-developer-api',
      audience: 'someone-else',
    });

    expect(tokens.verify(foreign)).toBeNull();
  });

  it('should refuse a secret shorter than 32 characters', () => {
    expect(() => new JwtAccessTokens(config({ JWT_ACCESS_SECRET: 'short' }))).toThrow(
      'JWT_ACCESS_SECRET must be at least 32 characters.',
    );
  });
});
