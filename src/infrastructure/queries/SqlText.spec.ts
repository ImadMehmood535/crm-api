import { containsPattern, searchOrNull } from './SqlText';

describe('SqlText', () => {
  it('should wrap the term and escape LIKE wildcards', () => {
    expect(containsPattern(' 50%_off ')).toBe('%50\\%\\_off%');
  });

  it('should treat blank search as none', () => {
    expect(searchOrNull('  ')).toBeNull();
    expect(searchOrNull(undefined)).toBeNull();
    expect(searchOrNull(' palm ')).toBe('palm');
  });
});
