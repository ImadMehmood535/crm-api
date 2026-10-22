export const REFRESH_TOKENS = Symbol('REFRESH_TOKENS');

export interface IssuedRefreshToken {
  /** Handed to the client once; never stored. */
  readonly token: string;
  readonly hash: string;
  readonly expiresAt: Date;
}

export interface IRefreshTokens {
  issue(): IssuedRefreshToken;
  hashOf(token: string): string;
}
