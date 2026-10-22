/** `%term%` for ILIKE, with the user's own % and _ escaped so they match literally. */
export function containsPattern(search: string): string {
  return `%${search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Trimmed search text, or null when there is nothing to search for. */
export function searchOrNull(search: string | undefined): string | null {
  const trimmed = search?.trim();
  return trimmed ? trimmed : null;
}
