import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { describe, expect, test } from "vitest";

import { IdentityError } from "../errors/identity.error";

import { TokenHash } from "./token-hash.value-object";

describe("TokenHash Value Object", () => {
  test("creates a token hash with the given value", () => {
    const hash = faker.string.alphanumeric(32);
    const tokenHash = TokenHash.create(hash);

    expect(tokenHash.value).toBe(hash);
  });

  test("creates a token hash after trimming whitespace", () => {
    const hash = faker.string.alphanumeric(32);
    const hashWithTrailingSpace = hash + " ";

    const tokenHash = TokenHash.create(hashWithTrailingSpace);

    expect(tokenHash.value).toBe(hash);
  });

  test("considers different token hashes as not equal", () => {
    const firstHash = faker.string.alphanumeric(32);
    const secondHash = faker.string.alphanumeric(32);

    const firstTokenHash = TokenHash.create(firstHash);
    const secondTokenHash = TokenHash.create(secondHash);

    expect(secondTokenHash.equals(firstTokenHash)).toBe(false);
  });

  test("considers the same token hash as equal", () => {
    const hash = faker.string.alphanumeric(32);
    const tokenHash = TokenHash.create(hash);
    const otherTokenHash = TokenHash.create(hash);

    expect(tokenHash.equals(otherTokenHash)).toBe(true);
  });

  test("throws when token hash is empty", () => {
    const emptyHash = "";

    expect(() => TokenHash.create(emptyHash)).toThrow(AppError);
    expect(() => TokenHash.create(emptyHash)).toThrow(
      IdentityError.TokenHashRequired.code,
    );
  });

  test("throws when token hash is undefined", () => {
    expect(() => TokenHash.create(undefined as never)).toThrow(AppError);
    expect(() => TokenHash.create(undefined as never)).toThrow(
      IdentityError.TokenHashRequired.code,
    );
  });

  test("throws when token hash is null", () => {
    expect(() => TokenHash.create(null as never)).toThrow(AppError);
    expect(() => TokenHash.create(null as never)).toThrow(
      IdentityError.TokenHashRequired.code,
    );
  });
});
