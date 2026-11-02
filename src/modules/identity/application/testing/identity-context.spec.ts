import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityOutboxEffect } from "../outbox/identity-outbox-effect";

import {
  createIdentityContext,
  recordedEmails,
  seedAccount,
  seedSession,
} from "./identity-context";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("identity context", () => {
  describe("seedAccount", () => {
    it("saves an account with an e-mail credential and a user membership", async () => {
      const ctx = createIdentityContext();

      const ana = await seedAccount(ctx);

      expect(ana.accountId).toBe(ana.account.id.value);
      expect(ana.account.email.value).toBe(ana.email);
      expect(ana.credential.toSnapshot()).toMatchObject({
        accountId: ana.accountId,
        provider: AuthProvider.EMAIL,
        subject: ana.email,
        passwordHash: `$fake$${ana.password}`,
      });
      expect(ana.membership.role).toBe(MembershipRole.USER);
      expect(ana.actor).toEqual({
        accountId: ana.accountId,
        sessionId: expect.any(String) as string,
        membershipId: ana.membership.id.value,
        role: MembershipRole.USER,
        permissions: [],
      });
      expect(await ctx.sessions.findById(ana.actor.sessionId)).toBeNull();
      expect(await ctx.accounts.findById(ana.accountId)).not.toBeNull();
      expect(await ctx.credentials.listByAccountId(ana.accountId)).toHaveLength(
        1,
      );
      expect(
        await ctx.memberships.findByAccountId(ana.accountId),
      ).not.toBeNull();
    });

    it("uses the given name, e-mail (lowercased), password and role", async () => {
      const ctx = createIdentityContext();
      const name = faker.person.fullName();
      const email = faker.internet.email();
      const password = faker.internet.password();

      const admin = await seedAccount(ctx, {
        name,
        email: email.toUpperCase(),
        password,
        role: MembershipRole.ADMIN,
      });

      expect(admin.account.name).toBe(name);
      expect(admin.email).toBe(email.toLowerCase());
      expect(admin.password).toBe(password);
      expect(admin.membership.role).toBe(MembershipRole.ADMIN);
      expect(admin.actor.role).toBe(MembershipRole.ADMIN);
    });
  });

  describe("seedSession", () => {
    it("saves a session that expires in 30 days and returns its refresh token", async () => {
      const ctx = createIdentityContext();
      const ana = await seedAccount(ctx);

      const now = ctx.clock.now();

      const { session, refreshToken, actor } = await seedSession(ctx, ana);

      expect(session.credentialId.value).toBe(ana.credential.id.value);
      expect(session.expiresAt).toEqual(
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      );
      const stored = await ctx.sessions.findByTokenHash(`hash:${refreshToken}`);
      expect(stored?.id.value).toBe(session.id.value);
      expect(actor).toEqual({ ...ana.actor, sessionId: session.id.value });
    });

    it("uses the given credential and time to live", async () => {
      const ctx = createIdentityContext();
      const ana = await seedAccount(ctx);
      const credentialId = faker.database.mongodbObjectId();
      const now = ctx.clock.now();

      const { session } = await seedSession(ctx, ana, {
        credentialId,
        ttlMs: 1_000,
      });

      expect(session.credentialId.value).toBe(credentialId);
      expect(session.expiresAt).toEqual(new Date(now.getTime() + 1_000));
    });
  });

  describe("recordedEmails", () => {
    it("lists the payloads recorded in the outbox for one type, oldest first", async () => {
      const ctx = createIdentityContext();
      const buildEmail = () => ({
        to: faker.internet.email(),
        name: faker.person.fullName(),
        token: faker.string.alphanumeric(32),
        expiresAt: faker.date.soon(),
      });
      const first = buildEmail();
      const second = buildEmail();
      const other = buildEmail();
      await ctx.outbox.record({
        type: IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
        payload: first,
      });
      await ctx.outbox.record({
        type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
        payload: other,
      });
      await ctx.outbox.record({
        type: IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
        payload: second,
      });

      const emails = recordedEmails(
        ctx,
        IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
      );

      expect(emails).toStrictEqual([first, second]);
    });
  });
});
