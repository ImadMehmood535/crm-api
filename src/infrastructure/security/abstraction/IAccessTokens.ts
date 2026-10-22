export const ACCESS_TOKENS = Symbol('ACCESS_TOKENS');

export interface AccessClaims {
  readonly userId: string;
  readonly sessionId: string;
}

export interface IAccessTokens {
  readonly ttlSeconds: number;
  sign(claims: AccessClaims): string;
  /** Returns the claims, or null for a forged, expired or malformed token. */
  verify(token: string): AccessClaims | null;
}
