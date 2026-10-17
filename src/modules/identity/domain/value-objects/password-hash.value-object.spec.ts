import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { describe, expect, test } from "vitest";

import { IdentityError } from "../errors/identity.error";

import { PasswordHash } from "./password-hash.value-object";

describe("PasswordHash Value Object", () => {
  test("creates a password hash with the given value", () => {
    const hash = "$" + faker.internet.password({ length: 10 });
    const passwordHash = PasswordHash.create(hash);

    expect(passwordHash.value).toBe(hash);
  });

  test("updates the password hash with a new value", () => {
    const passwordHash = PasswordHash.create(
      "$" + faker.internet.password({ length: 10 }),
    );
    const updatedHash = "$" + faker.internet.password({ length: 10 });

    passwordHash.update(updatedHash);

    expect(passwordHash.value).toBe(updatedHash);
  });

  test("throws when password hash is empty", () => {
    const emptyHash = "";

    expect(() => PasswordHash.create(emptyHash)).toThrow(AppError);
    expect(() => PasswordHash.create(emptyHash)).toThrow(
      IdentityError.PasswordHashRequired.code,
    );
  });

  test("throws when password hash is undefined", () => {
    expect(() => PasswordHash.create(undefined as never)).toThrow(AppError);
    expect(() => PasswordHash.create(undefined as never)).toThrow(
      IdentityError.PasswordHashRequired.code,
    );
  });

  test("throws when password hash does not start with $", () => {
    const invalidHash = faker.internet.password({ length: 10 });

    expect(() => PasswordHash.create(invalidHash)).toThrow(AppError);
    expect(() => PasswordHash.create(invalidHash)).toThrow(
      IdentityError.PasswordHashInvalid.code,
    );
  });

  test("throws when the updated password hash is invalid", () => {
    const passwordHash = PasswordHash.create(
      "$" + faker.internet.password({ length: 10 }),
    );
    const invalidHash = faker.internet.password({ length: 10 });

    expect(() => passwordHash.update(invalidHash)).toThrow(
      IdentityError.PasswordHashInvalid.code,
    );
  });

  test("trims whitespace from the password hash", () => {
    const hash = "$" + faker.internet.password({ length: 10 });
    const hashWithTrailingSpace = hash + " ";

    const passwordHash = PasswordHash.create(hashWithTrailingSpace);

    expect(passwordHash.value).toBe(hashWithTrailingSpace);
    passwordHash.update(hashWithTrailingSpace);
    expect(passwordHash.value).toBe(hash);
  });
});
