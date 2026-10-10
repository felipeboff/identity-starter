import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { bigint } from "./bigint";

describe("bigint", () => {
  it("returns a bigint when the input is a bigint", () => {
    const value = BigInt(faker.number.int());
    const parsed = bigint().parse(value);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(value);
  });

  it("coerces a safe integer number", () => {
    const value = faker.number.int();
    const parsed = bigint().parse(value);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(BigInt(value));
  });

  it("coerces a trimmed integer string", () => {
    const value = faker.number.int();
    const parsed = bigint().parse(`  ${value}  `);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(BigInt(value));
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(bigint().parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = bigint({ optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = bigint({ nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_bigint violation when the input cannot be coerced", () => {
    expect(bigint().parse(faker.lorem.word())).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_bigint" }],
    });
  });

  it("returns an invalid_bigint violation for a decimal number", () => {
    expect(bigint().parse(1.5)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_bigint" }],
    });
  });

  it("returns an invalid_bigint violation for a decimal string", () => {
    expect(bigint().parse("1.5")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_bigint" }],
    });
  });

  it("applies transform to the coerced value", () => {
    const parsed = bigint({ transform: (value) => value + 1n }).parse(10);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(11n);
  });

  it("returns a min violation when the value is below the minimum", () => {
    expect(bigint({ min: 10n }).parse(5n)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "min" }],
    });
  });

  it("accepts a value that meets the minimum", () => {
    const parsed = bigint({ min: 10n }).parse(10n);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(10n);
  });

  it("returns a max violation when the value is above the maximum", () => {
    expect(bigint({ max: 10n }).parse(11n)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "max" }],
    });
  });

  it("accepts a value that meets the maximum", () => {
    const parsed = bigint({ max: 10n }).parse(10n);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(10n);
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      bigint({ refine: [{ check: () => false, reason }] }).parse(1n),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});
