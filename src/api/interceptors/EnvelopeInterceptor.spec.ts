import { PagedResult } from '@shared/utils/Pagination';

import { wrap } from './EnvelopeInterceptor';

describe('wrap', () => {
  it('should wrap a plain result in data', () => {
    expect(wrap({ id: '1' })).toEqual({ success: true, data: { id: '1' } });
  });

  it('should turn an empty result into data: null', () => {
    expect(wrap(undefined)).toEqual({ success: true, data: null });
  });

  it('should split a page into data and meta', () => {
    const page = PagedResult.of([{ id: '1' }], { page: 1, pageSize: 20 }, 1);

    expect(wrap(page)).toEqual({
      success: true,
      data: [{ id: '1' }],
      meta: { page: 1, pageSize: 20, total: 1 },
    });
  });
});
