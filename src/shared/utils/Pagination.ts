export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

/** Returned by list handlers; the envelope turns it into `{ success, data: items, meta }`. */
export class PagedResult<T> {
  constructor(
    readonly items: readonly T[],
    readonly meta: PageMeta,
  ) {}

  static of<T>(items: readonly T[], request: PageRequest, total: number): PagedResult<T> {
    return new PagedResult(items, { page: request.page, pageSize: request.pageSize, total });
  }
}

export function offsetOf(request: PageRequest): number {
  return (request.page - 1) * request.pageSize;
}
