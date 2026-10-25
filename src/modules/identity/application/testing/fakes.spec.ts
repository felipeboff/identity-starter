import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  FakeAccessToken,
  FakeClock,
  FakeIdGenerator,
  FakeIdentityMailer,
  FakeOAuthGateway,
  FakePasswordHasher,
  FakeTokenIssuer,
} from "./fakes";

import { AuthProvider } from "@/identity/domain/credential.entity";

describe("fakes", () => {
  describe("FakeClock", () => {
    it("starts at 2026-01-01 12:00 UTC and returns copies", () => {
      const clock = new FakeClock();

      clock.now().setFullYear(2000);

      expect(clock.now()).toEqual(new Date("2026-01-01T12:00:00.000Z"));
    });

    it("starts at the given instant and advances", () => {
      const start = faker.date.recent();
      const clock = new FakeClock(start);

      clock.advance(1_000);

      expect(clock.now()).toEqual(new Date(start.getTime() + 1_000));
    });
  });

  describe("FakeIdGenerator", () => {
    it("returns a different id each time", () => {
      const ids = new FakeIdGenerator();

      expect(ids.next()).not.toBe(ids.next());
    });
  });

  describe("FakePasswordHasher", () => {
    it("hashes as $fake$<password> and verifies only that password", async () => {
      const hasher = new FakePasswordHasher();
      const password = faker.internet.password();

      const hash = await hasher.hash(password);

      expect(hash).toBe(`$fake$${password}`);
      expect(await hasher.verify(password, hash)).toBe(true);
      expect(await hasher.verify(`${password}-wrong`, hash)).toBe(false);
    });
  });

  describe("FakeTokenIssuer", () => {
    it("issues a token whose hash is hash:<token>", () => {
      const tokens = new FakeTokenIssuer();

      const { token, tokenHash } = tokens.issue();

      const other = faker.string.alphanumeric(32);
      expect(tokenHash).toBe(`hash:${token}`);
      expect(tokens.hash(other)).toBe(`hash:${other}`);
    });
  });

  describe("FakeAccessToken", () => {
    it("issues access:<accountId>:<sessionId> and verifies it back", async () => {
      const accessToken = new FakeAccessToken();
      const claims = {
        accountId: faker.database.mongodbObjectId(),
        sessionId: faker.database.mongodbObjectId(),
      };

      const token = await accessToken.issue(claims);

      expect(token).toBe(`access:${claims.accountId}:${claims.sessionId}`);
      await expect(accessToken.verify(token)).resolves.toEqual(claims);
    });

    it.each(["bearer:a:b", "access::b", "access:a:", "garbage"])(
      "returns null for %s",
      async (token) => {
        await expect(new FakeAccessToken().verify(token)).resolves.toBeNull();
      },
    );
  });

  describe("FakeIdentityMailer", () => {
    it("records every e-mail it sends", async () => {
      const mailer = new FakeIdentityMailer();
      const email = {
        to: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
        token: faker.string.alphanumeric(32),
        expiresAt: faker.date.soon(),
      };

      await mailer.sendPasswordReset(email);
      await mailer.sendEmailVerification(email);

      expect(mailer.passwordResets).toEqual([email]);
      expect(mailer.emailVerifications).toEqual([email]);
    });
  });

  describe("FakeOAuthGateway", () => {
    it("returns the profile registered for the provider and code", async () => {
      const oauth = new FakeOAuthGateway();
      const code = faker.string.alphanumeric(20);
      const profile = {
        subject: faker.string.numeric(21),
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
      };
      oauth.register(AuthProvider.GOOGLE, code, profile);

      expect(await oauth.exchangeCode(AuthProvider.GOOGLE, code)).toEqual(
        profile,
      );
    });

    it("rejects unknown codes", async () => {
      const oauth = new FakeOAuthGateway();
      const code = faker.string.alphanumeric(20);

      await expect(
        oauth.exchangeCode(AuthProvider.GITHUB, code),
      ).rejects.toThrow(`Unknown OAuth code: github:${code}`);
    });
  });
});
