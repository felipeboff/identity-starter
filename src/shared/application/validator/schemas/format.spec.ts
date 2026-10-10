import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { email, objectId, uuid } from "./format";

describe("email", () => {
  it("returns a lowercase email", () => {
    const address = faker.internet.email();
    const parsed = email().parse(address.toUpperCase());

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(address.toLowerCase());
  });

  it("trims the email by default", () => {
    const address = faker.internet.email().toLowerCase();
    const parsed = email().parse(`  ${address}  `);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(address);
  });

  it("does not trim the value when trim is disabled", () => {
    const parsed = email({ trim: false, empty: true }).parse("");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("");
  });

  it("keeps the original case when lowercase is disabled", () => {
    const parsed = email({ lowercase: false }).parse("User@Example.COM");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("User@Example.COM");
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(email().parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = email({ optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = email({ nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_email violation when the input is not a string", () => {
    expect(email().parse(10)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_email" }],
    });
  });

  it("returns an invalid_email violation when the format is invalid", () => {
    expect(email().parse("invalid-email")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_email" }],
    });
  });

  it("allows an empty string when empty is enabled", () => {
    const parsed = email({ empty: true }).parse("   ");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("");
  });

  it("applies transform to the formatted value", () => {
    const parsed = email({
      transform: (value) => `x${value}`,
    }).parse("user@example.com");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("xuser@example.com");
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      email({ refine: [{ check: () => false, reason }] }).parse(
        "user@example.com",
      ),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});

describe("uuid", () => {
  it("returns a lowercase uuid", () => {
    const value = faker.string.uuid();
    const parsed = uuid().parse(value.toUpperCase());

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(value.toLowerCase());
  });

  it("returns an invalid_uuid violation when the format is invalid", () => {
    expect(uuid().parse("invalid-uuid")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_uuid" }],
    });
  });
});

describe("objectId", () => {
  it("returns a lowercase object id", () => {
    const value = faker.database.mongodbObjectId();
    const parsed = objectId().parse(value.toUpperCase());

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(value.toLowerCase());
  });

  it("returns an invalid_object_id violation when the format is invalid", () => {
    expect(objectId().parse("abc")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_object_id" }],
    });
  });
});
