export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  /** False for a mismatch or an unusable stored hash. Constant-time comparison. */
  verify(plain: string, stored: string): Promise<boolean>;
  /** Spends the time of a real check so an unknown email is not faster than a wrong password. */
  dummyVerify(plain: string): Promise<false>;
}
