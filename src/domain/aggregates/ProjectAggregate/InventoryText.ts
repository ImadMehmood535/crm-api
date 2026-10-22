/** "  Palm   Heights " → "palm heights": names and numbers compare this way for uniqueness. */
export function nameKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

const PAD = 10;

/** Natural order key: digit runs zero-padded, so "A-2" sorts before "A-10". */
export function naturalSortKey(value: string): string {
  return nameKey(value).replace(/\d+/g, (digits) => digits.padStart(PAD, '0'));
}
