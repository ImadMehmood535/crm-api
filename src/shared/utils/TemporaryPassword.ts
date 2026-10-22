import { randomInt } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function group(length: number): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

/** One-time password shown once to whoever creates the account, e.g. `Tmp-K4f9a-Xm2Pq-7hRtW`. */
export function newTemporaryPassword(): string {
  return `Tmp-${group(5)}-${group(5)}-${group(5)}`;
}
