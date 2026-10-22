import { PagedResult, offsetOf } from './Pagination';

describe('Pagination', () => {
  it('should compute the row offset of a page', () => {
    expect(offsetOf({ page: 1, pageSize: 20 })).toBe(0);
    expect(offsetOf({ page: 3, pageSize: 20 })).toBe(40);
  });

  it('should build meta from the request and the total', () => {
    const result = PagedResult.of(['a'], { page: 2, pageSize: 1 }, 5);

    expect(result.items).toEqual(['a']);
    expect(result.meta).toEqual({ page: 2, pageSize: 1, total: 5 });
  });
});
