import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { bigint } from "./bigint";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

describe("bigint", () => {
  const integer = faker.number.int({ min: -1_000_000, max: 1_000_000 });

  it.each([
    ["a bigint", BigInt(integer)],
    ["a safe integer number", integer],
    ["a trimmed integer string", `  ${integer}  `],
  ])("accepts %s", (_, input) => {
    expect(bigint().parse(input)).toEqual(ok(BigInt(integer)));
  });

  it.each([
    ["a word", faker.lorem.word()],
    ["a decimal number", 1.5],
    ["a decimal string", "1.5"],
  ])("rejects %s as invalid_bigint", (_, input) => {
    expect(bigint().parse(input)).toEqual(fail("invalid_bigint"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(bigint().parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(bigint({ optional: true }).parse(undefined)).toEqual(
        ok(undefined),
      );
    });

    it("accepts null when nullable", () => {
      expect(bigint({ nullable: true }).parse(null)).toEqual(ok(null));
    });
  });

  it("applies transform to the coerced value", () => {
    const schema = bigint({ transform: (value) => value + 1n });

    expect(schema.parse(integer)).toEqual(ok(BigInt(integer) + 1n));
  });

  describe("range", () => {
    it.each([
      [{ min: 10n }, 10n, ok(10n)],
      [{ min: 10n }, 5n, fail("min")],
      [{ max: 10n }, 10n, ok(10n)],
      [{ max: 10n }, 11n, fail("max")],
    ])("with %o parses %s", (options, input, expected) => {
      expect(bigint(options).parse(input)).toEqual(expected);
    });
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = bigint({ refine: [{ check: () => false, reason }] });

    expect(schema.parse(BigInt(integer))).toEqual(fail(reason));
  });
});
