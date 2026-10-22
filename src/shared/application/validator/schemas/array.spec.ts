import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { array } from "./array";
import { number } from "./number";
import { object } from "./object";
import { string } from "./string";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string, field = "") => ({
  ok: false,
  violations: [{ field, reason }],
});

const tags = array(string());

describe("array", () => {
  const first = faker.lorem.word();
  const second = faker.lorem.word();

  it("accepts an array of valid items", () => {
    expect(tags.parse([first, second])).toEqual(ok([first, second]));
  });

  it("rejects a non-array as invalid_array", () => {
    expect(tags.parse(first)).toEqual(fail("invalid_array"));
  });

  describe("item violations", () => {
    it("prefixes the violation with the item index", () => {
      expect(tags.parse([first, {}])).toEqual(fail("invalid_string", "1"));
    });

    it("nests the item field under the index", () => {
      const people = array(object({ name: string() }));

      expect(people.parse([{ name: {} }])).toEqual(
        fail("invalid_string", "0.name"),
      );
    });
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(tags.parse(undefined)).toEqual(fail("required"));
    });

    it("rejects null as invalid_type by default", () => {
      expect(tags.parse(null)).toEqual(fail("invalid_type"));
    });

    it("accepts undefined when optional", () => {
      expect(array(string(), { optional: true }).parse(undefined)).toEqual(
        ok(undefined),
      );
    });

    it("accepts null when nullable", () => {
      expect(array(string(), { nullable: true }).parse(null)).toEqual(ok(null));
    });

    it("parses the default when the input is missing", () => {
      expect(array(string(), { default: [first] }).parse(undefined)).toEqual(
        ok([first]),
      );
    });
  });

  describe("length", () => {
    it.each([
      [{ minLength: 2 }, [first, second], ok([first, second])],
      [{ minLength: 2 }, [first], fail("min_length")],
      [{ maxLength: 1 }, [first], ok([first])],
      [{ maxLength: 1 }, [first, second], fail("max_length")],
    ])("with %o parses %o", (options, input, expected) => {
      expect(array(string(), options).parse(input)).toEqual(expected);
    });
  });

  it("applies transform to the parsed array", () => {
    const schema = array(string(), {
      transform: (items) => items.map((item) => item.toUpperCase()),
    });

    expect(schema.parse([first, second])).toEqual(
      ok([first.toUpperCase(), second.toUpperCase()]),
    );
  });

  describe("refine", () => {
    it("reports violations after a successful parse", () => {
      const reason = faker.lorem.slug();
      const schema = array(string(), {
        refine: [{ check: () => false, reason }],
      });

      expect(schema.parse([first])).toEqual(fail(reason));
    });

    it("keeps the parsed array when refinements pass", () => {
      const schema = array(string(), {
        refine: [{ check: () => true, reason: faker.lorem.slug() }],
      });

      expect(schema.parse([first])).toEqual(ok([first]));
    });
  });

  describe("csv", () => {
    const csvTags = array(string(), { csv: true });

    it.each([
      [
        "splits a comma-separated string",
        `${first},${second}`,
        [first, second],
      ],
      ["trims items and drops blank ones", ` ,${first}, `, [first]],
      ["still accepts an array", [first, second], [first, second]],
    ])("%s", (_, input, expected) => {
      expect(csvTags.parse(input)).toEqual(ok(expected));
    });

    it("passes each split item to the item schema", () => {
      const numbers = [
        faker.number.int(),
        faker.number.int(),
        faker.number.int(),
      ];

      expect(
        array(number(), { csv: true }).parse(
          `${numbers[0]}, ${numbers[1]},${numbers[2]}`,
        ),
      ).toEqual(ok(numbers));
    });

    it.each([
      [{ minLength: 1 }, " , , ", "min_length"],
      [{ maxLength: 1 }, `${first},${second}`, "max_length"],
    ])("checks %o after splitting", (options, input, reason) => {
      expect(array(string(), { csv: true, ...options }).parse(input)).toEqual(
        fail(reason),
      );
    });

    it("rejects other non-array inputs as invalid_array", () => {
      expect(csvTags.parse(faker.number.int())).toEqual(fail("invalid_array"));
    });
  });
});
