import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import type { Schema } from "../types";

import { array } from "./array";

const stringItem: Schema<string> = {
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

describe("array", () => {
  it("returns the parsed items when the input is an array", () => {
    const items = [faker.lorem.word(), faker.lorem.word()];
    const parsed = array(stringItem).parse(items);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(items);
  });

  it("finishes with a required violation when the input is missing", () => {
    const parsed = array(stringItem).parse(undefined);

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = array(stringItem, { optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with an invalid_type violation when the input is null", () => {
    const parsed = array(stringItem).parse(null);

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_type" }],
    });
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = array(stringItem, { nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("leaves the default array for further parsing when the input is missing", () => {
    const defaultValue = [faker.lorem.word()];
    const parsed = array(stringItem, { default: defaultValue }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(defaultValue);
  });

  it("returns an invalid_array violation when the input is not an array", () => {
    const parsed = array(stringItem).parse(faker.lorem.word());

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_array" }],
    });
  });

  it("returns a min_length violation when the array is too short", () => {
    const parsed = array(stringItem, { minLength: 2 }).parse([
      faker.lorem.word(),
    ]);

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "", reason: "min_length" }],
    });
  });

  it("accepts an array that meets the min length", () => {
    const items = [faker.lorem.word(), faker.lorem.word()];
    const parsed = array(stringItem, { minLength: 2 }).parse(items);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(items);
  });

  it("returns a max_length violation when the array is too long", () => {
    const parsed = array(stringItem, { maxLength: 1 }).parse([
      faker.lorem.word(),
      faker.lorem.word(),
    ]);

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "", reason: "max_length" }],
    });
  });

  it("accepts an array that meets the max length", () => {
    const items = [faker.lorem.word()];
    const parsed = array(stringItem, { maxLength: 1 }).parse(items);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(items);
  });

  it("prefixes item violations with the index", () => {
    const parsed = array(stringItem).parse([faker.lorem.word(), 10]);

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "1", reason: "invalid_string" }],
    });
  });

  it("nests the item field under the index", () => {
    const itemSchema: Schema<string> = {
      parse() {
        return {
          ok: false,
          violations: [{ field: "name", reason: "invalid" }],
        };
      },
    };

    const parsed = array(itemSchema).parse([faker.lorem.word()]);

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "0.name", reason: "invalid" }],
    });
  });

  it("applies transform to the parsed array", () => {
    const first = faker.lorem.word();
    const second = faker.lorem.word();
    const parsed = array(stringItem, {
      transform: (items) => items.map((item) => item.toUpperCase()),
    }).parse([first, second]);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual([first.toUpperCase(), second.toUpperCase()]);
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();
    const parsed = array(stringItem, {
      refine: [{ check: () => false, reason }],
    }).parse([faker.lorem.word()]);

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });

  it("keeps the parsed array when refinements pass", () => {
    const items = [faker.lorem.word()];
    const parsed = array(stringItem, {
      refine: [{ check: () => true, reason: faker.lorem.word() }],
    }).parse(items);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(items);
  });
});
