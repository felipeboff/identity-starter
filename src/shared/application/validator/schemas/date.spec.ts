import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { date } from "./date";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe("date", () => {
  const moment = faker.date.past();
  const isoDay = moment.toISOString().slice(0, 10);
  const startOfDay = new Date(`${isoDay}T00:00:00.000Z`);

  it.each([
    ["an iso date", isoDay, startOfDay],
    ["an iso date-time", moment.toISOString(), moment],
    ["a timestamp", moment.getTime(), moment],
  ])("accepts %s", (_, input, expected) => {
    expect(date().parse(input)).toEqual(ok(expected));
  });

  it("returns a copy of a valid date instance", () => {
    const parsed = date().parse(moment);

    expect(parsed).toEqual(ok(moment));
    expect(parsed.ok && parsed.data).not.toBe(moment);
  });

  it.each([
    ["a word", faker.lorem.word()],
    ["an impossible calendar date", "2026-02-30"],
    ["a date-time with an impossible calendar date", "2026-02-30T12:00:00Z"],
    ["a date-time with an impossible offset", "2026-10-09T12:30:45+99:99"],
    ["an invalid date instance", new Date(Number.NaN)],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a timestamp out of range", Number.MAX_VALUE],
  ])("rejects %s as invalid_date", (_, input) => {
    expect(date().parse(input)).toEqual(fail("invalid_date"));
  });

  it("rejects a date without offset when an offset is required", () => {
    expect(date({ requireOffset: true }).parse(isoDay)).toEqual(
      fail("invalid_date"),
    );
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(date().parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(date({ optional: true }).parse(undefined)).toEqual(ok(undefined));
    });

    it("accepts null when nullable", () => {
      expect(date({ nullable: true }).parse(null)).toEqual(ok(null));
    });
  });

  it("applies transform to the parsed date", () => {
    const schema = date({
      transform: (value) => new Date(value.getTime() + 1000),
    });

    expect(schema.parse(moment.toISOString())).toEqual(
      ok(new Date(moment.getTime() + 1000)),
    );
  });

  describe("range", () => {
    const dayBefore = new Date(startOfDay.getTime() - ONE_DAY_MS);
    const dayAfter = new Date(startOfDay.getTime() + ONE_DAY_MS);

    it.each([
      ["min on the same day", { min: startOfDay }, ok(startOfDay)],
      ["min on the next day", { min: dayAfter }, fail("min")],
      ["max on the same day", { max: startOfDay }, ok(startOfDay)],
      ["max on the previous day", { max: dayBefore }, fail("max")],
    ])("with %s", (_, options, expected) => {
      expect(date(options).parse(isoDay)).toEqual(expected);
    });
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = date({ refine: [{ check: () => false, reason }] });

    expect(schema.parse(isoDay)).toEqual(fail(reason));
  });
});
