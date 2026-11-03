import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  FakeAccessToken,
  FakeIdGenerator,
  FakeIdentityMailer,
  FakeOAuthGateway,
  FakePasswordHasher,
  FakeTokenIssuer,
} from "./fakes";

import { AuthProvider } from "@/identity/domain/credential.entity";

describe("fakes", () => {
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
      expect(await hasher.verify(faker.internet.password(), hash)).toBe(false);
    });

    it("refuses any password when there is no hash", async () => {
      const hasher = new FakePasswordHasher();

      expect(await hasher.verify(faker.internet.password(), null)).toBe(false);
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

      const invitation = {
        to: email.to,
        inviterName: faker.person.fullName(),
        token: email.token,
        expiresAt: email.expiresAt,
      };

      await mailer.sendPasswordReset(email);
      await mailer.sendEmailVerification(email);
      await mailer.sendInvitation(invitation);
      await mailer.sendEmailChange(email);

      expect(mailer.passwordResets).toEqual([email]);
      expect(mailer.emailVerifications).toEqual([email]);
      expect(mailer.invitations).toEqual([invitation]);
      expect(mailer.emailChanges).toEqual([email]);
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

      const exchange = { provider: AuthProvider.GOOGLE, code };

      expect(await oauth.exchangeCode(exchange)).toEqual(profile);
      expect(oauth.exchanges).toStrictEqual([exchange]);
    });

    it("rejects unknown codes", async () => {
      const oauth = new FakeOAuthGateway();
      const code = faker.string.alphanumeric(20);

      await expect(
        oauth.exchangeCode({ provider: AuthProvider.GITHUB, code }),
      ).rejects.toThrow(`Unknown OAuth code: github:${code}`);
    });
  });
});
