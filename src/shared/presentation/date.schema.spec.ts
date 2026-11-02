import { faker } from "@faker-js/faker";
import Type from "typebox";
import Value from "typebox/value";
import { describe, expect, it } from "vitest";

import { dateSchema } from "./date.schema";
import { SchemaParser } from "./schema-parser";

describe("dateSchema", () => {
  const parser = new SchemaParser();
  const schema = Type.Object({ at: dateSchema });

  it("keeps a valid Date and refuses anything else", () => {
    const at = faker.date.anytime();
    const refused = [
      at.getTime(),
      new Date(Number.NaN),
      null,
      faker.lorem.word(),
      at.toISOString().slice(0, 10),
      "2026-02-30T10:00:00Z",
      "2026-12-31T23:59:60Z",
    ];

    const kept = parser.safeParse(schema, { at });
    const results = refused.map((value) =>
      parser.safeParse(schema, { at: value }),
    );

    expect(kept).toStrictEqual({ ok: true, data: { at } });
    expect(results).toStrictEqual(
      refused.map(() => ({
        ok: false,
        violations: [{ field: "at", reason: "~refine" }],
      })),
    );
  });

  it.each([
    ["UTC", faker.date.anytime().toISOString()],
    ["an offset", "2026-11-02T10:00:00.123+03:00"],
  ])(
    "decodes an ISO date-time string into the Date of that instant (%s)",
    (_zone, text) => {
      const parsed = parser.safeParse(schema, { at: text });

      expect(parsed).toStrictEqual({
        ok: true,
        data: { at: new Date(Date.parse(text)) },
      });
    },
  );

  it("encodes a Date as its ISO date-time", () => {
    const at = faker.date.anytime();

    expect(Value.Encode(schema, { at })).toStrictEqual({
      at: at.toISOString(),
    });
  });
});
