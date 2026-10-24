import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import { record } from "./record";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

describe("record", () => {
  it("returns a shallow copy of a plain object", () => {
    const name = faker.person.firstName();
    const tags = [faker.lorem.word()];
    const input = { name, tags };

    const parsed = record().parse(input);

    expect(parsed).toEqual(ok({ name, tags: [...tags] }));
    expect(parsed.ok && parsed.data).not.toBe(input);
    expect(parsed.ok && parsed.data.tags).toBe(tags);
  });

  it("accepts an object without a prototype", () => {
    const name = faker.person.firstName();
    const input = Object.create(null) as Record<string, unknown>;
    input.name = name;

    expect(record().parse(input)).toEqual(ok({ name }));
  });

  it("keeps a __proto__ key as an own property instead of changing the prototype", () => {
    const key = faker.string.alpha({ length: 12 });
    const input = JSON.parse(`{"__proto__": {"${key}": true}}`) as unknown;

    const parsed = record().parse(input);

    expect(parsed.ok).toBe(true);
    const data = parsed.ok ? parsed.data : {};
    expect(Object.getPrototypeOf(data)).toBe(Object.prototype);
    expect(Object.hasOwn(data, "__proto__")).toBe(true);
    expect(data[key]).toBeUndefined();
  });

  it.each([
    ["an array", [faker.lorem.word()]],
    ["a date", faker.date.past()],
    ["a class instance", new (class Example {})()],
    ["a string", faker.lorem.word()],
    ["a number", faker.number.int()],
    ["a boolean", faker.datatype.boolean()],
  ])("rejects %s as invalid_object", (_, input) => {
    expect(record().parse(input)).toEqual(fail("invalid_object"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(record().parse(undefined)).toEqual(fail("required"));
    });

    it("rejects null as invalid_type by default", () => {
      expect(record().parse(null)).toEqual(fail("invalid_type"));
    });

    it("accepts undefined when optional", () => {
      expect(record({ optional: true }).parse(undefined)).toEqual(
        ok(undefined),
      );
    });

    it("accepts null when nullable", () => {
      expect(record({ nullable: true }).parse(null)).toEqual(ok(null));
    });

    it("uses the default when the input is missing", () => {
      const fallback = { name: faker.person.firstName() };

      expect(record({ default: fallback }).parse(undefined)).toEqual(
        ok(fallback),
      );
    });
  });

  it("runs refinements on the transformed value", () => {
    const reason = faker.lorem.slug();
    const marker = faker.string.alpha({ length: 12 });
    const schema = record({
      transform: (value) => ({ ...value, [marker]: true }),
      refine: [{ check: (value) => value[marker] !== true, reason }],
    });

    expect(schema.parse({})).toEqual(fail(reason));
  });

  it("skips transform and refinements for an invalid input", () => {
    const transform = vi.fn((value: Record<string, unknown>) => value);
    const check = vi.fn(() => true);

    record({
      transform,
      refine: [{ check, reason: faker.lorem.slug() }],
    }).parse([]);

    expect(transform).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
  });
});
