import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { email, objectId, uuid } from "./format";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

describe("email", () => {
  const address = faker.internet.email().toLowerCase();

  it.each([
    ["lowercases", address.toUpperCase()],
    ["trims", `  ${address}  `],
  ])("%s the e-mail by default", (_, input) => {
    expect(email().parse(input)).toEqual(ok(address));
  });

  it("keeps the original case when lowercase is disabled", () => {
    const upper = address.toUpperCase();

    expect(email({ lowercase: false }).parse(upper)).toEqual(ok(upper));
  });

  it.each([
    ["a number", faker.number.int()],
    ["a malformed e-mail", faker.lorem.word()],
  ])("rejects %s as invalid_email", (_, input) => {
    expect(email().parse(input)).toEqual(fail("invalid_email"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(email().parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(email({ optional: true }).parse(undefined)).toEqual(ok(undefined));
    });

    it("accepts null when nullable", () => {
      expect(email({ nullable: true }).parse(null)).toEqual(ok(null));
    });

    it("accepts a blank string as empty when empty is enabled", () => {
      expect(email({ empty: true }).parse("   ")).toEqual(ok(""));
    });

    it("accepts an empty string untrimmed when trim is disabled", () => {
      expect(email({ trim: false, empty: true }).parse("")).toEqual(ok(""));
    });
  });

  it("applies transform to the formatted value", () => {
    const prefix = faker.string.alpha({ length: 8 });
    const schema = email({ transform: (value) => `${prefix}${value}` });

    expect(schema.parse(address)).toEqual(ok(`${prefix}${address}`));
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = email({ refine: [{ check: () => false, reason }] });

    expect(schema.parse(address)).toEqual(fail(reason));
  });
});

describe("uuid", () => {
  it("lowercases a valid uuid", () => {
    const value = faker.string.uuid({ version: 7 });

    expect(uuid().parse(value.toUpperCase())).toEqual(ok(value));
  });

  it("rejects a malformed uuid as invalid_uuid", () => {
    expect(uuid().parse(faker.lorem.word())).toEqual(fail("invalid_uuid"));
  });
});

describe("objectId", () => {
  it("lowercases a valid object id", () => {
    const value = faker.database.mongodbObjectId();

    expect(objectId().parse(value.toUpperCase())).toEqual(ok(value));
  });

  it("rejects a malformed object id as invalid_object_id", () => {
    expect(objectId().parse(faker.lorem.word())).toEqual(
      fail("invalid_object_id"),
    );
  });
});
