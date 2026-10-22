import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { SharedError } from "../errors/shared.error";

import { Email } from "./email.value-object";

describe("Email", () => {
  const address = faker.internet.email().toLowerCase();

  it.each([
    ["keeps a lowercase address", address],
    ["lowercases the address", address.toUpperCase()],
    ["trims surrounding whitespace", `  ${address} `],
  ])("%s", (_, input) => {
    expect(Email.create(input).value).toBe(address);
  });

  it("is equal to another email with the same address", () => {
    const email = Email.create(address);

    expect(email.equals(Email.create(address.toUpperCase()))).toBe(true);
    expect(email.equals(Email.create(`other.${address}`))).toBe(false);
  });

  it.each([
    ["empty", "", SharedError.EmailRequired],
    ["undefined", undefined, SharedError.EmailRequired],
    ["null", null, SharedError.EmailRequired],
    ["missing the @", faker.internet.domainName(), SharedError.EmailInvalid],
    [
      "longer than 254 characters",
      `${faker.string.alpha(255)}@${faker.internet.domainName()}`,
      SharedError.EmailTooLong,
    ],
  ])("throws when the address is %s", (_, input, error) => {
    expect(() => Email.create(input as string)).toThrow(error.code);
  });
});
