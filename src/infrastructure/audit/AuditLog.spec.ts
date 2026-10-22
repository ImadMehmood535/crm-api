import { redact } from './AuditLog';

describe('redact', () => {
  it('should drop secret-looking keys at any depth and keep the rest', () => {
    expect(
      redact({
        status: 'active',
        temporaryPassword: 'Tmp-x',
        superUser: { email: 'a@b.co', passwordHash: 'scrypt$...' },
        tokenHash: 'abc',
        list: [1, 2],
      }),
    ).toEqual({ status: 'active', superUser: { email: 'a@b.co' }, list: [1, 2] });
  });

  it('should keep null as null', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeNull();
  });
});
