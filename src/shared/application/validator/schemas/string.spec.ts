import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { string } from "./string";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

describe("string", () => {
  const word = faker.lorem.word();
  const integer = faker.number.int();
  const decimal = faker.number.float({ fractionDigits: 2 });
  const day = faker.date.past();
  const suffix = faker.string.alpha({ length: 8 });

  it.each([
    ["a string", word, word],
    ["true", true, "true"],
    ["false", false, "false"],
    ["a bigint", BigInt(integer), String(integer)],
    ["a number", decimal, String(decimal)],
    ["a valid date", day, day.toISOString()],
  ])("accepts %s", (_, input, expected) => {
    expect(string().parse(input)).toEqual(ok(expected));
  });

  it.each([
    ["an object", {}],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["an invalid date", new Date(Number.NaN)],
  ])("rejects %s as invalid_string", (_, input) => {
    expect(string().parse(input)).toEqual(fail("invalid_string"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(string().parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(string({ optional: true }).parse(undefined)).toEqual(
        ok(undefined),
      );
    });

    it("accepts null when nullable", () => {
      expect(string({ nullable: true }).parse(null)).toEqual(ok(null));
    });
  });

  describe("normalization", () => {
    it.each([
      ["trim", { trim: true }, `  ${word}  `, word],
      [
        "lowercase",
        { lowercase: true },
        word.toUpperCase(),
        word.toLowerCase(),
      ],
      ["uppercase", { uppercase: true }, word, word.toUpperCase()],
      [
        "transform",
        { transform: (v: string) => `${v}${suffix}` },
        word,
        `${word}${suffix}`,
      ],
    ])("applies %s", (_, options, input, expected) => {
      expect(string(options).parse(input)).toEqual(ok(expected));
    });
  });

  describe("length", () => {
    const two = faker.string.alpha(2);
    const three = faker.string.alpha(3);

    it.each([
      [{ minLength: 2 }, two, ok(two)],
      [{ minLength: 3 }, two, fail("min_length")],
      [{ maxLength: 3 }, three, ok(three)],
      [{ maxLength: 2 }, three, fail("max_length")],
    ])("with %o parses %s", (options, input, expected) => {
      expect(string(options).parse(input)).toEqual(expected);
    });
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = string({ refine: [{ check: () => false, reason }] });

    expect(schema.parse(word)).toEqual(fail(reason));
  });
});
