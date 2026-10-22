import { ScryptPasswordHasher } from './ScryptPasswordHasher';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('should verify the password it hashed', async () => {
    const stored = await hasher.hash('correct horse battery');

    expect(stored.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(await hasher.verify('correct horse battery', stored)).toBe(true);
  });

  it('should reject a wrong password', async () => {
    const stored = await hasher.hash('correct horse battery');

    expect(await hasher.verify('wrong horse battery', stored)).toBe(false);
  });

  it('should reject a malformed stored hash', async () => {
    expect(await hasher.verify('anything', 'not-a-hash')).toBe(false);
  });

  it('should salt every hash differently', async () => {
    expect(await hasher.hash('same password!')).not.toBe(await hasher.hash('same password!'));
  });

  it('should always resolve false from dummyVerify', async () => {
    expect(await hasher.dummyVerify('whatever')).toBe(false);
  });
});
