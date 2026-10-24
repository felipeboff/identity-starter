import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { enumValue } from "./enum";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

const values = ["draft", "published"] as const;
const outsideValue = faker.string.alpha({ length: 12 });

describe("enumValue", () => {
  it("accepts an allowed string value", () => {
    expect(enumValue({ values }).parse("draft")).toEqual(ok("draft"));
  });

  it("accepts an allowed numeric value", () => {
    expect(enumValue({ values: [1, 2] as const }).parse(2)).toEqual(ok(2));
  });

  it("rejects a value outside the list as invalid_enum", () => {
    expect(enumValue({ values }).parse(outsideValue)).toEqual(
      fail("invalid_enum"),
    );
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(enumValue({ values }).parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(enumValue({ values, optional: true }).parse(undefined)).toEqual(
        ok(undefined),
      );
    });

    it("accepts null when nullable", () => {
      expect(enumValue({ values, nullable: true }).parse(null)).toEqual(
        ok(null),
      );
    });
  });

  describe("transform", () => {
    it("applies transform to the allowed value", () => {
      const schema = enumValue({ values, transform: () => "published" });

      expect(schema.parse("draft")).toEqual(ok("published"));
    });

    it("rejects a transformed value outside the list as invalid_enum", () => {
      const schema = enumValue({
        values,
        transform: () => outsideValue as (typeof values)[number],
      });

      expect(schema.parse("draft")).toEqual(fail("invalid_enum"));
    });
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = enumValue({
      values,
      refine: [{ check: () => false, reason }],
    });

    expect(schema.parse("draft")).toEqual(fail(reason));
  });
});
