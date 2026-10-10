import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { enumValue } from "./enum";

const values = ["draft", "published"] as const;

describe("enumValue", () => {
  it("returns the value when it is allowed", () => {
    const parsed = enumValue({ values }).parse("draft");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("draft");
  });

  it("accepts a numeric enum value", () => {
    const parsed = enumValue({ values: [1, 2] as const }).parse(2);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(2);
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(enumValue({ values }).parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = enumValue({ values, optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = enumValue({ values, nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_enum violation when the value is not allowed", () => {
    expect(enumValue({ values }).parse("archived")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_enum" }],
    });
  });

  it("applies transform to the allowed value", () => {
    const parsed = enumValue({
      values,
      transform: () => "published",
    }).parse("draft");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("published");
  });

  it("returns an invalid_enum violation when transform leaves an unknown value", () => {
    expect(
      enumValue({
        values,
        transform: () => "archived" as (typeof values)[number],
      }).parse("draft"),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_enum" }],
    });
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      enumValue({
        values,
        refine: [{ check: () => false, reason }],
      }).parse("draft"),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});
