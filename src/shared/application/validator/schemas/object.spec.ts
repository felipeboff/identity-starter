import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import type { Schema } from "../types";

import { object } from "./object";

const stringField: Schema<string> = {
  parse(input) {
    if (typeof input !== "string") {
      return {
        ok: false,
        violations: [{ field: "", reason: "invalid_string" }],
      };
    }

    return { ok: true, data: input };
  },
};

const optionalStringField: Schema<string | undefined> = {
  parse(input) {
    if (input === undefined) return { ok: true, data: undefined };
    if (typeof input !== "string") {
      return {
        ok: false,
        violations: [{ field: "", reason: "invalid_string" }],
      };
    }

    return { ok: true, data: input };
  },
};

describe("object", () => {
  it("returns the parsed object when the input matches the shape", () => {
    const name = faker.person.firstName();
    const parsed = object({ name: stringField }).parse({ name });

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual({ name });
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(object({ name: stringField }).parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = object({ name: stringField }, { optional: true }).parse(
      undefined,
    );

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = object({ name: stringField }, { nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_object violation when the input is not a plain object", () => {
    expect(object({ name: stringField }).parse([])).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_object" }],
    });
  });

  it("prefixes field violations with the field name", () => {
    expect(object({ name: stringField }).parse({ name: 10 })).toEqual({
      ok: false,
      violations: [{ field: "name", reason: "invalid_string" }],
    });
  });

  it("omits an optional field when it is missing", () => {
    const parsed = object({
      name: optionalStringField,
    }).parse({});

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual({});
  });

  it("keeps an optional field when it is present", () => {
    const name = faker.person.firstName();
    const parsed = object({
      name: optionalStringField,
    }).parse({ name });

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual({ name });
  });

  it("keeps a present field even when its parsed value is undefined", () => {
    const parsed = object({
      name: optionalStringField,
    }).parse({ name: undefined });

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(Object.hasOwn(parsed.data, "name")).toBe(true);
    expect(parsed.data.name).toBeUndefined();
  });

  it("applies transform to the parsed object", () => {
    const parsed = object(
      { name: stringField },
      { transform: (value) => ({ name: value.name.toUpperCase() }) },
    ).parse({ name: "ana" });

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual({ name: "ANA" });
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      object(
        { name: stringField },
        { refine: [{ check: () => false, reason }] },
      ).parse({ name: faker.person.firstName() }),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});
