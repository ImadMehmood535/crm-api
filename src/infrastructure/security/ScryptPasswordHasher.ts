import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

import { Injectable } from '@nestjs/common';

import { IPasswordHasher } from './abstraction/IPasswordHasher';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** scrypt (memory-hard, built into Node). Stored as `scrypt$N$r$p$salt$hash` (base64). */
@Injectable()
export class ScryptPasswordHasher implements IPasswordHasher {
  private dummyHash: Promise<string> | undefined;

  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await scryptAsync(plain, salt, KEY_LENGTH, { N, r: R, p: P });
    return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(plain: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, salt, key] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !key) return false;
    const expected = Buffer.from(key, 'base64');
    const actual = await scryptAsync(plain, Buffer.from(salt, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  async dummyVerify(plain: string): Promise<false> {
    this.dummyHash ??= this.hash('timing-equalizer-not-a-real-password');
    await this.verify(plain, await this.dummyHash);
    return false;
  }
}
