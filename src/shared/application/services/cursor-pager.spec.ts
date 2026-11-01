import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { PAGE_DEFAULT_LIMIT, PAGE_MAX_LIMIT } from "../pagination.policy";

import { CursorPager } from "./cursor-pager";

describe("CursorPager", () => {
  const pager = new CursorPager();
  const idsOf = (length: number) =>
    Array.from({ length }, () => faker.database.mongodbObjectId());

  it("asks for one item past the page, after the cursor", () => {
    const cursor = faker.database.mongodbObjectId();
    const limit = faker.number.int({ min: 1, max: PAGE_MAX_LIMIT });

    expect(pager.queryFor({ cursor, limit })).toStrictEqual({
      after: cursor,
      limit: limit + 1,
    });
  });

  it("starts from the beginning without a cursor", () => {
    expect(pager.queryFor({ limit: PAGE_DEFAULT_LIMIT })).toStrictEqual({
      after: null,
      limit: PAGE_DEFAULT_LIMIT + 1,
    });
  });

  it("drops the extra item and points the next cursor at the last item kept", () => {
    const ids = idsOf(3);

    const page = pager.pageOf({
      fetched: ids,
      request: { limit: 2 },
      cursorOf: (id) => id,
    });

    expect(page).toStrictEqual({ items: ids.slice(0, 2), nextCursor: ids[1] });
  });

  it("has no next cursor on the last page", () => {
    const ids = idsOf(2);

    const page = pager.pageOf({
      fetched: ids,
      request: { limit: 2 },
      cursorOf: (id) => id,
    });

    expect(page).toStrictEqual({ items: ids, nextCursor: null });
  });
});
