import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { boolean } from "./boolean";

describe("boolean", () => {
  it("returns the boolean when the input is a boolean", () => {
    const value = faker.datatype.boolean();
    const parsed = boolean().parse(value);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(value);
  });

  it.each([
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
  ] as const)("coerces %s to %s", (input, expected) => {
    const parsed = boolean().parse(input);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(expected);
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(boolean().parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = boolean({ optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = boolean({ nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_boolean violation when the input cannot be coerced", () => {
    expect(boolean().parse(faker.lorem.word())).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_boolean" }],
    });
  });

  it("returns an invalid_boolean violation for an unsupported number", () => {
    expect(boolean().parse(2)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_boolean" }],
    });
  });

  it("applies transform to the coerced value", () => {
    const parsed = boolean({ transform: (value) => !value }).parse(true);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(false);
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      boolean({ refine: [{ check: () => false, reason }] }).parse(true),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});
