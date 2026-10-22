import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "./identity-context";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { EmailVerification } from "@/identity/domain/email-verification.entity";
import { PasswordReset } from "@/identity/domain/password-reset.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("in-memory repositories", () => {
  let ctx: IdentityContext;

  beforeEach(() => {
    ctx = createIdentityContext();
  });

  describe("accounts", () => {
    it("finds by id and by e-mail ignoring case", async () => {
      const ana = await seedAccount(ctx);

      const byId = await ctx.accounts.findById(ana.accountId);
      const byEmail = await ctx.accounts.findByEmail(ana.email.toUpperCase());

      expect(byId?.toSnapshot()).toEqual(ana.account.toSnapshot());
      expect(byEmail?.id.value).toBe(ana.accountId);
    });

    it("returns null when nothing matches", async () => {
      expect(
        await ctx.accounts.findById(faker.database.mongodbObjectId()),
      ).toBeNull();
      expect(await ctx.accounts.findByEmail(faker.internet.email())).toBeNull();
    });

    it("does not see changes that were not saved", async () => {
      const name = faker.person.fullName();
      const ana = await seedAccount(ctx, { name });
      ana.account.updateName(faker.person.fullName(), ctx.clock.now());

      const stored = await ctx.accounts.findById(ana.accountId);

      expect(stored?.name).toBe(name);
    });
  });

  describe("credentials", () => {
    it("finds by id, e-mail, provider + subject and account", async () => {
      const ana = await seedAccount(ctx);
      const googleSubject = faker.string.numeric(21);
      const google = Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: ana.accountId,
          provider: AuthProvider.GOOGLE,
          subject: googleSubject,
        },
        ctx.clock.now(),
      );
      await ctx.credentials.save(google);

      const byId = await ctx.credentials.findById(ana.credential.id.value);
      const byEmail = await ctx.credentials.findByEmail(
        ana.email.toUpperCase(),
      );
      const bySubject = await ctx.credentials.findByProviderAndSubject(
        AuthProvider.GOOGLE,
        googleSubject,
      );
      const all = await ctx.credentials.listByAccountId(ana.accountId);

      expect(byId?.id.value).toBe(ana.credential.id.value);
      expect(byEmail?.id.value).toBe(ana.credential.id.value);
      expect(bySubject?.id.value).toBe(google.id.value);
      expect(all).toHaveLength(2);
    });

    it("returns null or an empty list when nothing matches", async () => {
      expect(
        await ctx.credentials.findById(faker.database.mongodbObjectId()),
      ).toBeNull();
      expect(
        await ctx.credentials.findByEmail(faker.internet.email()),
      ).toBeNull();
      expect(
        await ctx.credentials.findByProviderAndSubject(
          AuthProvider.GITHUB,
          faker.string.numeric(10),
        ),
      ).toBeNull();
      expect(
        await ctx.credentials.listByAccountId(faker.database.mongodbObjectId()),
      ).toEqual([]);
    });
  });

  describe("memberships", () => {
    it("finds by id and by account", async () => {
      const ana = await seedAccount(ctx);

      const byId = await ctx.memberships.findById(ana.membership.id.value);
      const byAccount = await ctx.memberships.findByAccountId(ana.accountId);

      expect(byId?.toSnapshot()).toEqual(ana.membership.toSnapshot());
      expect(byAccount?.id.value).toBe(ana.membership.id.value);
    });

    it("returns null when nothing matches", async () => {
      expect(
        await ctx.memberships.findById(faker.database.mongodbObjectId()),
      ).toBeNull();
      expect(
        await ctx.memberships.findByAccountId(faker.database.mongodbObjectId()),
      ).toBeNull();
    });
  });

  describe("sessions", () => {
    it("finds by id, token hash, the current (not revoked) one and lists all", async () => {
      const ana = await seedAccount(ctx);
      const { session: loggedOut } = await seedSession(ctx, ana);
      loggedOut.revoke(SessionRevocationReason.LOGOUT, ctx.clock.now());
      await ctx.sessions.save(loggedOut);
      const { session, refreshToken } = await seedSession(ctx, ana);

      const byId = await ctx.sessions.findById(session.id.value);
      const byHash = await ctx.sessions.findByTokenHash(`hash:${refreshToken}`);
      const current = await ctx.sessions.findByAccountId(ana.accountId);
      const all = await ctx.sessions.listByAccountId(ana.accountId);

      expect(byId?.toSnapshot()).toEqual(session.toSnapshot());
      expect(byHash?.id.value).toBe(session.id.value);
      expect(current?.id.value).toBe(session.id.value);
      expect(all).toHaveLength(2);
    });

    it("returns null or an empty list when nothing matches", async () => {
      expect(
        await ctx.sessions.findById(faker.database.mongodbObjectId()),
      ).toBeNull();
      expect(
        await ctx.sessions.findByTokenHash(faker.string.alphanumeric(32)),
      ).toBeNull();
      expect(
        await ctx.sessions.findByAccountId(faker.database.mongodbObjectId()),
      ).toBeNull();
      expect(
        await ctx.sessions.listByAccountId(faker.database.mongodbObjectId()),
      ).toEqual([]);
    });
  });

  describe("password resets", () => {
    it("finds by token hash and lists by account", async () => {
      const accountId = faker.database.mongodbObjectId();
      const tokenHash = faker.string.alphanumeric(32);
      const reset = PasswordReset.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId,
          credentialId: faker.database.mongodbObjectId(),
          tokenHash,
          expiresAt: faker.date.soon(),
        },
        ctx.clock.now(),
      );
      await ctx.passwordResets.save(reset);

      const byHash = await ctx.passwordResets.findByTokenHash(tokenHash);
      const all = await ctx.passwordResets.listByAccountId(accountId);

      expect(byHash?.toSnapshot()).toEqual(reset.toSnapshot());
      expect(all).toHaveLength(1);
      expect(
        await ctx.passwordResets.findByTokenHash(faker.string.alphanumeric(32)),
      ).toBeNull();
    });
  });

  describe("email verifications", () => {
    it("finds by token hash and lists by account", async () => {
      const accountId = faker.database.mongodbObjectId();
      const tokenHash = faker.string.alphanumeric(32);
      const verification = EmailVerification.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId,
          tokenHash,
          expiresAt: faker.date.soon(),
        },
        ctx.clock.now(),
      );
      await ctx.emailVerifications.save(verification);

      const byHash = await ctx.emailVerifications.findByTokenHash(tokenHash);
      const all = await ctx.emailVerifications.listByAccountId(accountId);

      expect(byHash?.toSnapshot()).toEqual(verification.toSnapshot());
      expect(all).toHaveLength(1);
      expect(
        await ctx.emailVerifications.findByTokenHash(
          faker.string.alphanumeric(32),
        ),
      ).toBeNull();
    });
  });
});
