import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { Violation } from "../types";

import {
  addViolation,
  failure,
  isPlainObject,
  prefixViolations,
  resolveInput,
  result,
  runRefinements,
  success,
} from "./helpers";

describe("success", () => {
  it("wraps the data as a successful parse", () => {
    const data = faker.lorem.word();

    expect(success(data)).toEqual({ ok: true, data });
  });
});

describe("failure", () => {
  it("wraps a reason and a field as a failed parse", () => {
    const field = faker.lorem.word();

    expect(failure("invalid_email", field)).toEqual({
      ok: false,
      violations: [{ field, reason: "invalid_email" }],
    });
  });

  it("uses an empty field by default", () => {
    expect(failure("required")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });
});

describe("result", () => {
  it("is a success when there are no violations", () => {
    const value = faker.lorem.word();

    expect(result(value, [])).toEqual({ ok: true, data: value });
  });

  it("is a failure carrying the violations", () => {
    const violations: Violation[] = [
      { field: faker.lorem.word(), reason: "invalid_string" },
      { field: faker.lorem.word(), reason: "required" },
    ];

    expect(result(faker.lorem.word(), violations)).toEqual({
      ok: false,
      violations,
    });
  });
});

describe("resolveInput", () => {
  const value = faker.lorem.word();
  const fallback = faker.lorem.word();

  it.each([
    ["a defined value", value, undefined, value],
    [
      "a missing value with a default",
      undefined,
      { default: fallback },
      fallback,
    ],
  ])("continues parsing %s", (_, input, options, expected) => {
    expect(resolveInput(input, options)).toEqual({
      done: false,
      value: expected,
    });
  });

  it.each([
    ["undefined", undefined, undefined, failure("required")],
    [
      "undefined when optional",
      undefined,
      { optional: true },
      success(undefined),
    ],
    ["null", null, undefined, failure("invalid_type")],
    ["null when nullable", null, { nullable: true }, success(null)],
  ])("finishes parsing %s", (_, input, options, expected) => {
    expect(resolveInput(input, options)).toEqual({
      done: true,
      result: expected,
    });
  });
});

describe("addViolation", () => {
  it("appends a violation with an empty field by default", () => {
    const field = faker.lorem.word();
    const violations: Violation[] = [];

    addViolation(violations, "invalid_string");
    addViolation(violations, "required", field);

    expect(violations).toEqual([
      { field: "", reason: "invalid_string" },
      { field, reason: "required" },
    ]);
  });
});

describe("runRefinements", () => {
  it("returns no violations when there are no refinements", () => {
    expect(runRefinements(faker.lorem.word(), undefined)).toEqual([]);
  });

  it("reports only the checks that fail", () => {
    const word = faker.lorem.word();
    const field = faker.lorem.word();
    const failingReason = faker.lorem.slug();
    const passingReason = `${failingReason}-passing`;
    const failingWithFieldReason = `${failingReason}-with-field`;

    const violations = runRefinements(word, [
      { check: (value) => value !== word, reason: failingReason },
      { check: (value) => value === word, reason: passingReason },
      {
        check: (value) => value.length === 0,
        reason: failingWithFieldReason,
        field,
      },
    ]);

    expect(violations).toEqual([
      { field: "", reason: failingReason },
      { field, reason: failingWithFieldReason },
    ]);
  });
});

describe("prefixViolations", () => {
  it("nests each field under the prefix", () => {
    const prefix = faker.lorem.word();
    const field = faker.lorem.word();
    const violations: Violation[] = [
      { field: "", reason: "required" },
      { field, reason: "invalid_string" },
    ];

    expect(prefixViolations(prefix, violations)).toEqual([
      { field: prefix, reason: "required" },
      { field: `${prefix}.${field}`, reason: "invalid_string" },
    ]);
  });
});

describe("isPlainObject", () => {
  it.each([
    ["a literal object", { [faker.lorem.word()]: faker.lorem.word() }],
    ["an object without prototype", Object.create(null) as object],
  ])("accepts %s", (_, input) => {
    expect(isPlainObject(input)).toBe(true);
  });

  it.each([
    ["an array", [faker.lorem.word()]],
    ["a string", faker.lorem.word()],
    ["null", null],
    ["undefined", undefined],
    ["a Date", faker.date.anytime()],
    ["an Error", new Error(faker.lorem.sentence())],
    ["a Map", new Map()],
    ["a Set", new Set()],
  ])("rejects %s", (_, input) => {
    expect(isPlainObject(input)).toBe(false);
  });
});
