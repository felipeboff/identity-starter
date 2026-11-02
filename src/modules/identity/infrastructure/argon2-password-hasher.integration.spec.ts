import { faker } from "@faker-js/faker";
import argon2 from "argon2";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Argon2PasswordHasher } from "./argon2-password-hasher";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    it("verifies against an argon2id decoy and refuses when there is no hash", async () => {
      const password = faker.internet.password({ length: 16 });
      const verify = vi.spyOn(argon2, "verify");

      await expect(hasher.verify(password, null)).resolves.toBe(false);

      expect(verify.mock.calls).toStrictEqual([
        [expect.stringMatching(/^\$argon2id\$/), password],
      ]);
    });

    it("generates the decoy hash once for repeated calls", async () => {
      const fresh = new Argon2PasswordHasher();
      const hash = vi.spyOn(fresh, "hash");

      await fresh.verify(faker.internet.password({ length: 16 }), null);
      await fresh.verify(faker.internet.password({ length: 16 }), null);

      expect(hash).toHaveBeenCalledOnce();
    });

    it("generates the decoy hash again after a failed attempt", async () => {
      const fresh = new Argon2PasswordHasher();
      const failure = new Error(faker.lorem.sentence());
      vi.spyOn(fresh, "hash").mockRejectedValueOnce(failure);

      await expect(
        fresh.verify(faker.internet.password({ length: 16 }), null),
      ).rejects.toBe(failure);
      await expect(
        fresh.verify(faker.internet.password({ length: 16 }), null),
      ).resolves.toBe(false);
    });
  });
});
