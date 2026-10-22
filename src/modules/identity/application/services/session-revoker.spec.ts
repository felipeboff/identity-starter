import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("SessionRevoker", () => {
  let ctx: IdentityContext;

  beforeEach(() => {
    ctx = createIdentityContext();
  });

  it("revokes every active session of the account and leaves other accounts alone", async () => {
    const ana = await seedAccount(ctx);
    const bruno = await seedAccount(ctx);
    const { session: anaLaptop } = await seedSession(ctx, ana);
    const { session: anaPhone } = await seedSession(ctx, ana);
    const { session: brunoLaptop } = await seedSession(ctx, bruno);
    const now = ctx.clock.now();

    const revoked = await ctx.sessionRevoker.revokeActive(ana.accountId, {
      reason: SessionRevocationReason.SECURITY,
      at: now,
      revokedBy: bruno.accountId,
    });

    expect(revoked).toHaveLength(2);
    for (const session of [anaLaptop, anaPhone]) {
      const stored = await ctx.sessions.findById(session.id.value);
      expect(stored?.toSnapshot()).toMatchObject({
        revokedReason: SessionRevocationReason.SECURITY,
        revokedAt: now,
        acceptedByAccountId: bruno.accountId,
      });
    }
    const untouched = await ctx.sessions.findById(brunoLaptop.id.value);
    expect(untouched?.isRevoked()).toBe(false);
  });

  it("skips sessions that are already revoked or expired", async () => {
    const ana = await seedAccount(ctx);
    const { session: loggedOut } = await seedSession(ctx, ana);
    loggedOut.revoke(SessionRevocationReason.LOGOUT, ctx.clock.now());
    await ctx.sessions.save(loggedOut);
    const { session: expired } = await seedSession(ctx, ana, { ttlMs: 1_000 });
    ctx.clock.advance(2_000);

    const revoked = await ctx.sessionRevoker.revokeActive(ana.accountId, {
      reason: SessionRevocationReason.SECURITY,
      at: ctx.clock.now(),
    });

    expect(revoked).toEqual([]);
    const stillLoggedOut = await ctx.sessions.findById(loggedOut.id.value);
    expect(stillLoggedOut?.revokedReason).toBe(SessionRevocationReason.LOGOUT);
    const stillExpired = await ctx.sessions.findById(expired.id.value);
    expect(stillExpired?.isRevoked()).toBe(false);
  });

  it("only revokes the sessions accepted by `where`, without a revoker", async () => {
    const ana = await seedAccount(ctx);
    const googleCredentialId = faker.database.mongodbObjectId();
    const { session: viaEmail } = await seedSession(ctx, ana);
    const { session: viaGoogle } = await seedSession(ctx, ana, {
      credentialId: googleCredentialId,
    });

    const revoked = await ctx.sessionRevoker.revokeActive(ana.accountId, {
      reason: SessionRevocationReason.SECURITY,
      at: ctx.clock.now(),
      where: (session) => session.credentialId.value === googleCredentialId,
    });

    expect(revoked.map((session) => session.id.value)).toEqual([
      viaGoogle.id.value,
    ]);
    expect(revoked[0].acceptedByAccountId).toBeNull();
    const stored = await ctx.sessions.findById(viaEmail.id.value);
    expect(stored?.isRevoked()).toBe(false);
  });
});
