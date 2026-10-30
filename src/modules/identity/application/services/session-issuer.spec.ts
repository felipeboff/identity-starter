import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  SeededAccount,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { SessionIssuer } from "./session-issuer";

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
});
