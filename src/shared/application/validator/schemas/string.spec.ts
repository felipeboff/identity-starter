import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { string } from "./string";

describe("string", () => {
  it("returns the string when the input is a string", () => {
    const value = faker.lorem.word();
    const parsed = string().parse(value);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(value);
  });

  it.each([
    [true, "true"],
    [false, "false"],
    [10n, "10"],
    [12.5, "12.5"],
  ] as const)("coerces %s to %s", (input, expected) => {
    const parsed = string().parse(input);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(expected);
  });

  it("coerces a valid date to iso", () => {
    const value = new Date("2026-10-09T12:00:00.000Z");
    const parsed = string().parse(value);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(value.toISOString());
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(string().parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = string({ optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = string({ nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_string violation when the input cannot be coerced", () => {
    expect(string().parse({})).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_string" }],
    });
  });

  it("returns an invalid_string violation for Infinity", () => {
    expect(string().parse(Number.POSITIVE_INFINITY)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_string" }],
    });
  });

  it("returns an invalid_string violation for an invalid date", () => {
    expect(string().parse(new Date(Number.NaN))).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_string" }],
    });
  });

  it("trims the value when trim is enabled", () => {
    const parsed = string({ trim: true }).parse("  hello  ");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("hello");
  });

  it("lowercases the value when lowercase is enabled", () => {
    const parsed = string({ lowercase: true }).parse("Hello");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("hello");
  });

  it("uppercases the value when uppercase is enabled", () => {
    const parsed = string({ uppercase: true }).parse("Hello");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("HELLO");
  });

  it("applies transform to the coerced value", () => {
    const parsed = string({ transform: (value) => `${value}!` }).parse("hi");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("hi!");
  });

  it("returns a min_length violation when the string is too short", () => {
    expect(string({ minLength: 3 }).parse("hi")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "min_length" }],
    });
  });

  it("accepts a string that meets the min length", () => {
    const parsed = string({ minLength: 2 }).parse("hi");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("hi");
  });

  it("returns a max_length violation when the string is too long", () => {
    expect(string({ maxLength: 2 }).parse("hey")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "max_length" }],
    });
  });

  it("accepts a string that meets the max length", () => {
    const parsed = string({ maxLength: 3 }).parse("hey");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("hey");
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      string({ refine: [{ check: () => false, reason }] }).parse("ok"),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});
