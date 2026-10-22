import { isUuid, uuidv7 } from './Uuid';

describe('uuidv7', () => {
  it('should set the version nibble to 7 and the RFC variant bits', () => {
    const id = uuidv7();

    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
    expect(isUuid(id)).toBe(true);
  });

  it('should encode the timestamp in the first 48 bits', () => {
    const id = uuidv7(0x0123456789ab);

    expect(id.startsWith('01234567-89ab-7')).toBe(true);
  });

  it('should sort ids from later milliseconds after earlier ones', () => {
    const earlier = uuidv7(1_000);
    const later = uuidv7(1_001);

    expect(earlier < later).toBe(true);
  });

  it('should not repeat over 10k ids', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7()));

    expect(ids.size).toBe(10_000);
  });
});

describe('isUuid', () => {
  it('should reject a value that is not a UUID', () => {
    expect(isUuid('abc')).toBe(false);
  });
});
