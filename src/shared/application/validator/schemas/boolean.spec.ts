import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { boolean } from "./boolean";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

describe("boolean", () => {
  it.each([
    [true, true],
    [false, false],
    [1, true],
    [0, false],
    [1n, true],
    [0n, false],
    ["true", true],
    ["false", false],
    ["1", true],
    ["0", false],
    [" TRUE ", true],
    [" False ", false],
  ])("accepts %o as %s", (input, expected) => {
    expect(boolean().parse(input)).toEqual(ok(expected));
  });

  it.each([
    ["a word", faker.lorem.word()],
    ["an unsupported number", 2],
  ])("rejects %s as invalid_boolean", (_, input) => {
    expect(boolean().parse(input)).toEqual(fail("invalid_boolean"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(boolean().parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(boolean({ optional: true }).parse(undefined)).toEqual(
        ok(undefined),
      );
    });

    it("accepts null when nullable", () => {
      expect(boolean({ nullable: true }).parse(null)).toEqual(ok(null));
    });
  });

  it("applies transform to the coerced value", () => {
    expect(boolean({ transform: (value) => !value }).parse(true)).toEqual(
      ok(false),
    );
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = boolean({ refine: [{ check: () => false, reason }] });

    expect(schema.parse(faker.datatype.boolean())).toEqual(fail(reason));
  });
});
