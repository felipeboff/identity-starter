import type { Page, PageQuery, PageRequest } from "../pagination.policy";

export type PageSlice<T> = Readonly<{
  fetched: readonly T[];
  request: PageRequest;
  cursorOf: (item: T) => string;
}>;

export class CursorPager {
  /** One item past the page tells whether another page follows. */
  queryFor(request: PageRequest): PageQuery {
    return { after: request.cursor ?? null, limit: request.limit + 1 };
  }

  pageOf<T>(slice: PageSlice<T>): Page<T> {
    const items = slice.fetched.slice(0, slice.request.limit);
    return {
      items,
      nextCursor:
        slice.fetched.length > slice.request.limit
          ? slice.cursorOf(items[items.length - 1])
          : null,
    };
  }
}
