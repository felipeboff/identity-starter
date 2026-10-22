import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { object } from "./object";
import { string } from "./string";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string, field = "") => ({
  ok: false,
  violations: [{ field, reason }],
});

const person = object({ name: string() });
const personWithOptionalName = object({ name: string({ optional: true }) });

describe("object", () => {
  it("accepts an input matching the shape", () => {
    const name = faker.person.firstName();

    expect(person.parse({ name })).toEqual(ok({ name }));
  });

  it("rejects a non plain object as invalid_object", () => {
    expect(person.parse([])).toEqual(fail("invalid_object"));
  });

  it("prefixes field violations with the field name", () => {
    expect(person.parse({ name: {} })).toEqual(fail("invalid_string", "name"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(person.parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(
        object({ name: string() }, { optional: true }).parse(undefined),
      ).toEqual(ok(undefined));
    });

    it("accepts null when nullable", () => {
      expect(
        object({ name: string() }, { nullable: true }).parse(null),
      ).toEqual(ok(null));
    });
  });

  describe("optional fields", () => {
    it("omits the field when it is missing", () => {
      expect(personWithOptionalName.parse({})).toStrictEqual(ok({}));
    });

    it("keeps the field when it is present", () => {
      const name = faker.person.firstName();

      expect(personWithOptionalName.parse({ name })).toStrictEqual(
        ok({ name }),
      );
    });

    it("keeps the key when it is present with an undefined value", () => {
      expect(personWithOptionalName.parse({ name: undefined })).toStrictEqual(
        ok({ name: undefined }),
      );
    });
  });

  it("applies transform to the parsed object", () => {
    const name = faker.person.firstName();
    const schema = object(
      { name: string() },
      { transform: (value) => ({ name: value.name.toUpperCase() }) },
    );

    expect(schema.parse({ name })).toEqual(ok({ name: name.toUpperCase() }));
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = object(
      { name: string() },
      { refine: [{ check: () => false, reason }] },
    );

    expect(schema.parse({ name: faker.person.firstName() })).toEqual(
      fail(reason),
    );
  });
});
