import { hashToken, newSecureToken } from './SecureToken';
import { newTemporaryPassword } from './TemporaryPassword';

describe('newSecureToken', () => {
  it('should create distinct URL-safe tokens with a SHA-256 hash', () => {
    const token = newSecureToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toBe(newSecureToken());
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});

describe('newTemporaryPassword', () => {
  it('should be 21 characters, satisfy the 12-character policy and differ each time', () => {
    const password = newTemporaryPassword();

    expect(password).toMatch(/^Tmp-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/);
    expect(password).not.toBe(newTemporaryPassword());
  });
});
