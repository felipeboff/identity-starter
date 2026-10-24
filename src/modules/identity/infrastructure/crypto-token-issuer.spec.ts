import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { CryptoTokenIssuer } from "./crypto-token-issuer";

import { TokenHash } from "@/identity/domain/value-objects/token-hash.value-object";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

describe("CryptoTokenIssuer", () => {
  describe("issue", () => {
    it("returns a URL-safe token of 256 random bits and its hash", () => {
      const tokens = new CryptoTokenIssuer();

      const { token, tokenHash } = tokens.issue();

      expect(token).toMatch(TOKEN);
      expect(tokenHash).toBe(tokens.hash(token));
    });

    it("returns a different token on every call", () => {
      const tokens = new CryptoTokenIssuer();

      const issued = new Set(
        Array.from({ length: 100 }, () => tokens.issue().token),
      );

      expect(issued.size).toBe(100);
    });

    it("returns a hash the TokenHash value object accepts", () => {
      const { tokenHash } = new CryptoTokenIssuer().issue();

      expect(TokenHash.create(tokenHash).value).toBe(tokenHash);
    });
  });

  describe("hash", () => {
    it("is the SHA-256 of the token in hex", () => {
      // Test vector from FIPS 180-2.
      expect(new CryptoTokenIssuer().hash("abc")).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
    });

    it("always gives the same hash for the same token, so it can be looked up", () => {
      const tokens = new CryptoTokenIssuer();
      const token = faker.string.alphanumeric(43);

      expect(tokens.hash(token)).toBe(tokens.hash(token));
    });

    it("gives different hashes for different tokens", () => {
      const tokens = new CryptoTokenIssuer();
      const [first, second] = faker.helpers.uniqueArray(
        () => faker.string.alphanumeric(43),
        2,
      );

      expect(tokens.hash(first ?? "")).not.toBe(tokens.hash(second ?? ""));
    });
  });
});
