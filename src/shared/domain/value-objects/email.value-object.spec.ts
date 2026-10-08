import { faker } from "@faker-js/faker";
import { describe, expect, test } from "vitest";

import { AppError } from "../errors/app-error";
import { SharedError } from "../errors/shared.error";

import { Email } from "./email.value-object";

describe("Email Value Object", () => {
  test("creates an email with the given address", () => {
    const address = faker.internet.email().toLowerCase();
    const email = Email.create(address);
    expect(email.value).toBe(address);
  });

  test("creates an email with the given address in lowercase", () => {
    const address = faker.internet.email().toUpperCase();
    const email = Email.create(address);
    expect(email.value).toBe(address.toLowerCase());
  });

  test("considers different emails as not equal", () => {
    const firstAddress = faker.internet.email().toLowerCase();
    const secondAddress = faker.internet.email().toLowerCase();

    const firstEmail = Email.create(firstAddress);
    const secondEmail = Email.create(secondAddress);

    expect(secondEmail.equals(firstEmail)).toBe(false);
  });

  test("considers the same address as equal", () => {
    const address = faker.internet.email().toLowerCase();
    const email = Email.create(address);
    const otherEmail = Email.create(address);

    expect(email.equals(otherEmail)).toBe(true);
  });

  test("throws when email is invalid", () => {
    const invalidAddress = "invalid-email";

    expect(() => Email.create(invalidAddress)).toThrow(AppError);
    expect(() => Email.create(invalidAddress)).toThrow(
      SharedError.EmailInvalid.code,
    );
  });

  test("throws when email is empty", () => {
    const emptyAddress = "";

    expect(() => Email.create(emptyAddress)).toThrow(AppError);
    expect(() => Email.create(emptyAddress)).toThrow(
      SharedError.EmailRequired.code,
    );
  });

  test("throws when email is too long", () => {
    const tooLongAddress = faker.string.alphanumeric(255) + "@example.com";

    expect(() => Email.create(tooLongAddress)).toThrow(AppError);
    expect(() => Email.create(tooLongAddress)).toThrow(
      SharedError.EmailTooLong.code,
    );
  });

  test("throws when email is undefined", () => {
    expect(() => Email.create(undefined as never)).toThrow(AppError);
    expect(() => Email.create(undefined as never)).toThrow(
      SharedError.EmailRequired.code,
    );
  });

  test("throws when email is null", () => {
    expect(() => Email.create(null as never)).toThrow(AppError);
    expect(() => Email.create(null as never)).toThrow(
      SharedError.EmailRequired.code,
    );
  });

  test("trims trailing whitespace from the email", () => {
    const address = faker.internet.email().toLowerCase();
    const addressWithTrailingSpace = address + " ";

    const email = Email.create(addressWithTrailingSpace);
    expect(email.value).toBe(address);
  });
});
