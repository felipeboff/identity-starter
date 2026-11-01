import { faker } from "@faker-js/faker";
import Type from "typebox";
import { describe, expect, it } from "vitest";

import {
  PAGE_DEFAULT_LIMIT,
  PAGE_MAX_LIMIT,
} from "../application/pagination.policy";

import { pageRequestFields } from "./page-request.schema";
import { SchemaParser } from "./schema-parser";

describe("pageRequestFields", () => {
  const parser = new SchemaParser();
  const schema = Type.Object(pageRequestFields);

  it("defaults the limit and leaves the cursor out", () => {
    expect(parser.safeParse(schema, {})).toStrictEqual({
      ok: true,
      data: { limit: PAGE_DEFAULT_LIMIT },
    });
  });

  it("reads a cursor and a limit sent as query strings", () => {
    const cursor = faker.database.mongodbObjectId();
    const limit = faker.number.int({ min: 1, max: PAGE_MAX_LIMIT });

    expect(
      parser.safeParse(schema, { cursor, limit: String(limit) }),
    ).toStrictEqual({ ok: true, data: { cursor, limit } });
  });

  it.each([
    ["limit", "minimum", { limit: "0" }],
    [
      "limit",
      "maximum",
      {
        limit: String(
          faker.number.int({
            min: PAGE_MAX_LIMIT + 1,
            max: PAGE_MAX_LIMIT * 10,
          }),
        ),
      },
    ],
    ["cursor", "pattern", { cursor: faker.string.alpha(5) }],
  ])("refuses a %s failing %s", (field, reason, raw) => {
    expect(parser.safeParse(schema, raw)).toStrictEqual({
      ok: false,
      violations: [{ field, reason }],
    });
  });
});
