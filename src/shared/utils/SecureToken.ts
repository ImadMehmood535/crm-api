import { createHash, randomBytes } from 'crypto';

/** 256 random bits, URL-safe. Handed out once (e.g. in an invite link); only its hash is stored. */
export function newSecureToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
