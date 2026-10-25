import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { Argon2PasswordHasher } from "./argon2-password-hasher";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();

  describe("hash", () => {
    it("returns an argon2id hash that does not contain the password", async () => {
      const password = faker.internet.password({ length: 16 });

      const hash = await hasher.hash(password);

      expect(hash).toMatch(/^\$argon2id\$/);
      expect(hash).not.toContain(password);
    });

    it("salts every hash, so the same password hashes differently", async () => {
      const password = faker.internet.password({ length: 16 });

      const [first, second] = await Promise.all([
        hasher.hash(password),
        hasher.hash(password),
      ]);

      expect(first).not.toBe(second);
    });
  });

  describe("verify", () => {
    it("accepts the password that was hashed", async () => {
      const password = faker.internet.password({ length: 16 });
      const hash = await hasher.hash(password);

      await expect(hasher.verify(password, hash)).resolves.toBe(true);
    });

    it("refuses a different password", async () => {
      const [password, other] = faker.helpers.uniqueArray(
        () => faker.internet.password({ length: 16 }),
        2,
      );
      const hash = await hasher.hash(password ?? "");

      await expect(hasher.verify(other ?? "", hash)).resolves.toBe(false);
    });

    it("rejects a value that is not an argon2 hash", async () => {
      const password = faker.internet.password({ length: 16 });

      await expect(
        hasher.verify(password, faker.string.alphanumeric(40)),
      ).rejects.toThrow(TypeError);
    });
  });
});
