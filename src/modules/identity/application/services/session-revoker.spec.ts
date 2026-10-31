import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

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

  it("logs the revoked sessions once the transaction commits", async () => {
    const ana = await seedAccount(ctx);
    const bruno = await seedAccount(ctx);
    await seedSession(ctx, ana);
    await seedSession(ctx, ana);

    const revoked = await ctx.transactions.run(() =>
      ctx.sessionRevoker.revokeActive(ana.accountId, {
        reason: SessionRevocationReason.SECURITY,
        at: ctx.clock.now(),
        revokedBy: bruno.accountId,
      }),
    );

    expect(revoked).toHaveLength(2);
    expect(ctx.logger.entries).toStrictEqual([
      {
        level: LogLevel.INFO,
        event: IdentityUseCaseLogEvent.SessionsRevoked.name,
        fields: {
          accountId: ana.accountId,
          reason: SessionRevocationReason.SECURITY,
          revokedBy: bruno.accountId,
          sessionIds: revoked.map((session) => session.id.value),
        },
      },
    ]);
  });

  it("logs nothing when no session was active", async () => {
    const ana = await seedAccount(ctx);

    await ctx.sessionRevoker.revokeActive(ana.accountId, {
      reason: SessionRevocationReason.SECURITY,
      at: ctx.clock.now(),
    });

    expect(ctx.logger.entries).toStrictEqual([]);
  });

  it("logs nothing when the transaction fails", async () => {
    const ana = await seedAccount(ctx);
    await seedSession(ctx, ana);
    const failure = new Error(faker.lorem.sentence());

    await expect(
      ctx.transactions.run(async () => {
        await ctx.sessionRevoker.revokeActive(ana.accountId, {
          reason: SessionRevocationReason.SECURITY,
          at: ctx.clock.now(),
        });
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(ctx.logger.entries).toStrictEqual([]);
  });

  it("revokes one session and logs it", async () => {
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);
    const now = ctx.clock.now();

    await ctx.sessionRevoker.revoke(session, {
      reason: SessionRevocationReason.LOGOUT,
      at: now,
    });

    const stored = await ctx.sessions.findById(session.id.value);
    expect(stored?.toSnapshot()).toMatchObject({
      revokedReason: SessionRevocationReason.LOGOUT,
      revokedAt: now,
    });
    expect(ctx.logger.entries).toStrictEqual([
      {
        level: LogLevel.INFO,
        event: IdentityUseCaseLogEvent.SessionsRevoked.name,
        fields: {
          accountId: ana.accountId,
          reason: SessionRevocationReason.LOGOUT,
          revokedBy: null,
          sessionIds: [session.id.value],
        },
      },
    ]);
  });
});
