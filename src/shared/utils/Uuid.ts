import { randomBytes } from 'crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let lastMs = -1;
let last: Buffer = Buffer.alloc(16);

/** Adds one to the 74 bits after the timestamp (skipping version/variant bits): same-ms ids stay ordered. */
function increment(previous: Buffer): Buffer {
  const next = Buffer.from(previous);
  for (let i = 15; i >= 6; i--) {
    const limit = i === 6 ? 0x0f : i === 8 ? 0x3f : 0xff;
    const value = (next[i] & limit) + 1;
    next[i] = (next[i] & ~limit) | (value & limit);
    if (value <= limit) return next;
  }
  return next;
}

/**
 * RFC 9562 UUID v7: 48-bit Unix milliseconds + random bits, so ids sort by creation time. Within
 * one millisecond the random part is incremented (the RFC's monotonic method), so ids created by
 * this process never sort out of order.
 */
export function uuidv7(now: number = Date.now()): string {
  let bytes: Buffer;
  if (now <= lastMs) {
    bytes = increment(last);
  } else {
    bytes = randomBytes(16);
    bytes.writeUIntBE(now, 0, 6);
    bytes[6] = 0x70 | (bytes[6] & 0x0f);
    bytes[8] = 0x80 | (bytes[8] & 0x3f);
    lastMs = now;
  }
  last = bytes;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
