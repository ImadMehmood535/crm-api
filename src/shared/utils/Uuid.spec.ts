import { isUuid, uuidv7 } from './Uuid';

// uuidv7 remembers the last millisecond it used, so each test moves further into the future.
let clock = Date.now() + 1_000_000_000;
const tick = (): number => (clock += 1_000);

describe('uuidv7', () => {
  it('should set the version nibble to 7 and the RFC variant bits', () => {
    const id = uuidv7(tick());

    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
    expect(isUuid(id)).toBe(true);
  });

  it('should encode the timestamp in the first 48 bits', () => {
    const now = tick();

    const id = uuidv7(now);

    expect(id.replace(/-/g, '').slice(0, 12)).toBe(now.toString(16).padStart(12, '0'));
  });

  it('should sort ids from later milliseconds after earlier ones', () => {
    const earlier = uuidv7(tick());
    const later = uuidv7(tick());

    expect(earlier < later).toBe(true);
  });

  it('should keep ids created in the same millisecond in creation order', () => {
    const now = tick();

    const ids = Array.from({ length: 1000 }, () => uuidv7(now));

    expect([...ids].sort()).toEqual(ids);
    expect(ids.every((id) => id[14] === '7' && ['8', '9', 'a', 'b'].includes(id[19]))).toBe(true);
  });

  it('should never go backwards when the clock does', () => {
    const first = uuidv7(tick());

    const second = uuidv7(clock - 5_000);

    expect(first < second).toBe(true);
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
