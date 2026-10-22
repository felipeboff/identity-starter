import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  SeededAccount,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { SessionIssuer } from "./session-issuer";

import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("SessionIssuer", () => {
  let ctx: IdentityContext;
  let issuer: SessionIssuer;

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const sessionInputFor = (person: SeededAccount) => ({
    accountId: person.accountId,
    credentialId: person.credential.id.value,
    membershipId: person.membership.id.value,
    userAgent: faker.internet.userAgent(),
    ipAddress: faker.internet.ip(),
  });

  beforeEach(() => {
    ctx = createIdentityContext();
    issuer = new SessionIssuer(ctx);
  });

  describe("issue", () => {
    it("saves a session that expires in 30 days and returns its tokens", async () => {
      const ana = await seedAccount(ctx);
      const input = sessionInputFor(ana);
      const now = faker.date.recent();

      const issued = await issuer.issue(input, now);

      const stored = await ctx.sessions.findByTokenHash(
        ctx.tokens.hash(issued.refreshToken),
      );
      expect(stored?.toSnapshot()).toMatchObject({
        id: issued.session.id.value,
        ...input,
        createdAt: now,
        expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
        revokedAt: null,
      });
      expect(issued.accessToken).toBe(
        `access:${ana.accountId}:${issued.session.id.value}`,
      );
    });
  });

  describe("replace", () => {
    it("revokes the current session as REPLACED and issues a new one", async () => {
      const ana = await seedAccount(ctx);
      const { session: current } = await seedSession(ctx, ana);
      const now = ctx.clock.now();

      const issued = await issuer.replace(sessionInputFor(ana), now);

      const previous = await ctx.sessions.findById(current.id.value);
      expect(previous?.toSnapshot()).toMatchObject({
        revokedReason: SessionRevocationReason.REPLACED,
        revokedAt: now,
        acceptedByAccountId: ana.accountId,
      });
      const next = await ctx.sessions.findById(issued.session.id.value);
      expect(next?.isActive(now)).toBe(true);
    });

    it("just issues a session when there is no current one", async () => {
      const ana = await seedAccount(ctx);

      const issued = await issuer.replace(
        sessionInputFor(ana),
        ctx.clock.now(),
      );

      const sessions = await ctx.sessions.listByAccountId(ana.accountId);
      expect(sessions.map((session) => session.id.value)).toEqual([
        issued.session.id.value,
      ]);
    });
  });
});
