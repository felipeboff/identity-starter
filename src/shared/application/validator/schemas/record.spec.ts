import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { record } from "./record";

describe("record", () => {
  it("returns a copy of a plain object", () => {
    const input = { [faker.lorem.word()]: faker.lorem.word(), count: 1 };
    const parsed = record().parse(input);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(input);
    expect(parsed.data).not.toBe(input);
  });

  it("keeps values by reference without validating them", () => {
    const nested = { tags: [faker.lorem.word()] };
    const parsed = record().parse({ nested });

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data.nested).toBe(nested);
  });

  it("accepts an object without a prototype", () => {
    const input = Object.create(null) as Record<string, unknown>;
    input.name = faker.lorem.word();
    const parsed = record().parse(input);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual({ name: input.name });
  });

  it("keeps a __proto__ key as an own property", () => {
    const input = JSON.parse('{"__proto__": {"polluted": true}}') as unknown;
    const parsed = record().parse(input);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(Object.getPrototypeOf(parsed.data)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(parsed.data, "__proto__")).toBe(
      true,
    );
    expect((parsed.data as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it.each([
    ["an array", []],
    ["a date", new Date()],
    ["a class instance", new (class Example {})()],
    ["a string", "text"],
    ["a number", 10],
    ["a boolean", true],
  ])("returns an invalid_object violation for %s", (_, input) => {
    expect(record().parse(input)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_object" }],
    });
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(record().parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = record({ optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with an invalid_type violation when the input is null", () => {
    expect(record().parse(null)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_type" }],
    });
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = record({ nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("uses the default when the input is missing", () => {
    const defaultValue = { name: faker.lorem.word() };
    const parsed = record({ default: defaultValue }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toEqual(defaultValue);
  });

  it("runs refinements on the transformed value", () => {
    const reason = faker.lorem.word();
    const parsed = record({
      transform: (value) => ({ ...value, transformed: true }),
      refine: [{ check: (value) => value.transformed !== true, reason }],
    }).parse({});

    expect(parsed).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });

  it("does not run transform or refinements for an invalid input", () => {
    let calls = 0;
    const parsed = record({
      transform: (value) => {
        calls += 1;
        return value;
      },
      refine: [
        {
          check: () => {
            calls += 1;
            return true;
          },
          reason: faker.lorem.word(),
        },
      ],
    }).parse([]);

    expect(parsed.ok).toBe(false);
    expect(calls).toBe(0);
  });
});
