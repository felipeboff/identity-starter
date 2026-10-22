import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityError } from "../errors/identity.error";

import { TokenHash } from "./token-hash.value-object";

describe("TokenHash", () => {
  it("keeps the given value", () => {
    const value = faker.string.alphanumeric(32);

    expect(TokenHash.create(value).value).toBe(value);
  });

  it("trims surrounding whitespace", () => {
    const value = faker.string.alphanumeric(32);

    expect(TokenHash.create(` ${value} `).value).toBe(value);
  });

  it.each([
    ["an empty string", ""],
    ["undefined", undefined],
    ["null", null],
  ])("throws TokenHashRequired for %s", (_, input) => {
    expect(() => TokenHash.create(input as string)).toThrow(
      IdentityError.TokenHashRequired.code,
    );
  });

  it("is equal to another token hash with the same value", () => {
    const value = faker.string.alphanumeric(32);

    expect(TokenHash.create(value).equals(TokenHash.create(value))).toBe(true);
  });

  it("is not equal to a token hash with another value", () => {
    const first = TokenHash.create(faker.string.alphanumeric(32));
    const second = TokenHash.create(faker.string.alphanumeric(32));

    expect(first.equals(second)).toBe(false);
  });
});
