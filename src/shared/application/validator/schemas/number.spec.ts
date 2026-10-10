import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { number } from "./number";

describe("number", () => {
  it("returns the number when the input is a finite number", () => {
    const value = faker.number.float({ min: 1, max: 100 });
    const parsed = number().parse(value);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(value);
  });

  it("coerces a numeric string", () => {
    const parsed = number().parse("  12.5  ");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(12.5);
  });

  it("coerces a safe bigint", () => {
    const parsed = number().parse(10n);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(10);
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(number().parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = number({ optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = number({ nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_number violation when the input cannot be coerced", () => {
    expect(number().parse(faker.lorem.word())).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_number" }],
    });
  });

  it("returns an invalid_number violation for Infinity", () => {
    expect(number().parse(Number.POSITIVE_INFINITY)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_number" }],
    });
  });

  it("returns an invalid_number violation for a non-finite numeric string", () => {
    expect(number().parse("1e1000")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_number" }],
    });
  });

  it("returns an invalid_number violation for an unsafe bigint", () => {
    expect(number().parse(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_number" }],
    });
  });

  it("applies transform to the coerced value", () => {
    const parsed = number({ transform: (value) => value * 2 }).parse(4);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(8);
  });

  it("returns an invalid_integer violation when an integer is required", () => {
    expect(number({ integer: true }).parse(1.5)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_integer" }],
    });
  });

  it("accepts an integer when an integer is required", () => {
    const parsed = number({ integer: true }).parse(2);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(2);
  });

  it("returns a min violation when the value is below the minimum", () => {
    expect(number({ min: 10 }).parse(9)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "min" }],
    });
  });

  it("accepts a value that meets the minimum", () => {
    const parsed = number({ min: 10 }).parse(10);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(10);
  });

  it("returns a max violation when the value is above the maximum", () => {
    expect(number({ max: 10 }).parse(11)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "max" }],
    });
  });

  it("accepts a value that meets the maximum", () => {
    const parsed = number({ max: 10 }).parse(10);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(10);
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      number({ refine: [{ check: () => false, reason }] }).parse(1),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});
