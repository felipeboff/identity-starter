import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { date } from "./date";

describe("date", () => {
  it("parses an iso date", () => {
    const parsed = date().parse("2026-10-09");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(new Date("2026-10-09T00:00:00.000Z"));
  });

  it("parses an iso date-time with a timezone", () => {
    const parsed = date().parse("2026-10-09T12:30:45.123Z");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(new Date("2026-10-09T12:30:45.123Z"));
  });

  it("returns a copy of a valid date instance", () => {
    const value = new Date("2026-10-09T12:00:00.000Z");
    const parsed = date().parse(value);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(value);
    expect(parsed.data).not.toBe(value);
  });

  it("coerces a finite timestamp", () => {
    const timestamp = Date.parse("2026-10-09T12:00:00.000Z");
    const parsed = date().parse(timestamp);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(new Date(timestamp));
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(date().parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = date({ optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = date({ nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_date violation when the input cannot be coerced", () => {
    expect(date().parse(faker.lorem.word())).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_date" }],
    });
  });

  it("returns an invalid_date violation for an impossible calendar date", () => {
    expect(date().parse("2026-02-30")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_date" }],
    });
  });

  it("returns an invalid_date violation for a date-time with an impossible calendar date", () => {
    expect(date().parse("2026-02-30T12:00:00Z")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_date" }],
    });
  });

  it("returns an invalid_date violation when an offset is required", () => {
    expect(date({ requireOffset: true }).parse("2026-10-09")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_date" }],
    });
  });

  it("returns an invalid_date violation for an invalid date instance", () => {
    expect(date().parse(new Date(Number.NaN))).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_date" }],
    });
  });

  it("returns an invalid_date violation for a non-finite number", () => {
    expect(date().parse(Number.POSITIVE_INFINITY)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_date" }],
    });
  });

  it("returns an invalid_date violation for a timestamp that is not a valid date", () => {
    expect(date().parse(Number.MAX_VALUE)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_date" }],
    });
  });

  it("returns an invalid_date violation for a date-time that matches the pattern but is not parseable", () => {
    expect(date().parse("2026-10-09T12:30:45+99:99")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_date" }],
    });
  });

  it("applies transform to the parsed date", () => {
    const parsed = date({
      transform: (value) => new Date(value.getTime() + 1000),
    }).parse("2026-10-09T00:00:00.000Z");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(new Date("2026-10-09T00:00:01.000Z"));
  });

  it("returns a min violation when the date is before the minimum", () => {
    expect(
      date({ min: new Date("2026-10-10T00:00:00.000Z") }).parse("2026-10-09"),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason: "min" }],
    });
  });

  it("accepts a date that meets the minimum", () => {
    const parsed = date({
      min: new Date("2026-10-09T00:00:00.000Z"),
    }).parse("2026-10-09");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
  });

  it("returns a max violation when the date is after the maximum", () => {
    expect(
      date({ max: new Date("2026-10-08T00:00:00.000Z") }).parse("2026-10-09"),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason: "max" }],
    });
  });

  it("accepts a date that meets the maximum", () => {
    const parsed = date({
      max: new Date("2026-10-09T00:00:00.000Z"),
    }).parse("2026-10-09");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      date({ refine: [{ check: () => false, reason }] }).parse("2026-10-09"),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});
