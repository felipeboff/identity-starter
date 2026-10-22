import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityError } from "../errors/identity.error";

import { PasswordHash } from "./password-hash.value-object";

const fakeHash = () => `$${faker.string.alphanumeric(40)}`;

describe("PasswordHash", () => {
  describe("create", () => {
    it("keeps the given hash", () => {
      const hash = fakeHash();

      expect(PasswordHash.create(hash).value).toBe(hash);
    });

    it("keeps surrounding whitespace (create does not trim)", () => {
      const hash = `${fakeHash()} `;

      expect(PasswordHash.create(hash).value).toBe(hash);
    });

    it.each([
      ["an empty string", "", IdentityError.PasswordHashRequired],
      ["undefined", undefined, IdentityError.PasswordHashRequired],
      [
        "a hash without a leading $",
        faker.string.alphanumeric(40),
        IdentityError.PasswordHashInvalid,
      ],
    ])("throws for %s", (_, input, error) => {
      expect(() => PasswordHash.create(input as string)).toThrow(error.code);
    });
  });

  describe("update", () => {
    it("replaces the hash with the trimmed new value", () => {
      const passwordHash = PasswordHash.create(fakeHash());
      const newHash = fakeHash();

      passwordHash.update(` ${newHash} `);

      expect(passwordHash.value).toBe(newHash);
    });

    it("throws PasswordHashInvalid when the new hash has no leading $", () => {
      const passwordHash = PasswordHash.create(fakeHash());

      expect(() => passwordHash.update(faker.string.alphanumeric(40))).toThrow(
        IdentityError.PasswordHashInvalid.code,
      );
    });
  });
});
