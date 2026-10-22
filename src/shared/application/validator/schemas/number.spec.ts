import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { number } from "./number";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

describe("number", () => {
  const decimal = faker.number.float({
    min: -1000,
    max: 1000,
    fractionDigits: 2,
  });
  const integer = faker.number.int({ min: -1000, max: 1000 });

  it.each([
    ["a finite number", decimal, decimal],
    ["a trimmed numeric string", `  ${decimal}  `, decimal],
    ["a safe bigint", BigInt(integer), integer],
  ])("accepts %s", (_, input, expected) => {
    expect(number().parse(input)).toEqual(ok(expected));
  });

  it.each([
    ["a word", faker.lorem.word()],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a non-finite numeric string", "1e1000"],
    ["an unsafe bigint", BigInt(Number.MAX_SAFE_INTEGER) + 1n],
  ])("rejects %s as invalid_number", (_, input) => {
    expect(number().parse(input)).toEqual(fail("invalid_number"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(number().parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(number({ optional: true }).parse(undefined)).toEqual(
        ok(undefined),
      );
    });

    it("accepts null when nullable", () => {
      expect(number({ nullable: true }).parse(null)).toEqual(ok(null));
    });
  });

  it("applies transform to the coerced value", () => {
    const schema = number({ transform: (value) => value * 2 });

    expect(schema.parse(integer)).toEqual(ok(integer * 2));
  });

  describe("constraints", () => {
    it.each([
      [{ integer: true }, 2, ok(2)],
      [{ integer: true }, 1.5, fail("invalid_integer")],
      [{ min: 10 }, 10, ok(10)],
      [{ min: 10 }, 9, fail("min")],
      [{ max: 10 }, 10, ok(10)],
      [{ max: 10 }, 11, fail("max")],
    ])("with %o parses %s", (options, input, expected) => {
      expect(number(options).parse(input)).toEqual(expected);
    });
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = number({ refine: [{ check: () => false, reason }] });

    expect(schema.parse(integer)).toEqual(fail(reason));
  });
});
