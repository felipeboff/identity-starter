import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { RevokeAllSessionsUseCase } from "./revoke-all-sessions.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipRole } from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("RevokeAllSessionsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: RevokeAllSessionsUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new RevokeAllSessionsUseCase(ctx);
  });

  it("revokes every active session of the owner as SECURITY", async () => {
    const ana = await seedAccount(ctx);
    const laptop = await seedSession(ctx, ana);
    const phone = await seedSession(ctx, ana);

    const output = await useCase.execute(
      { accountId: ana.accountId },
      ana.actor,
    );

    expect(output.revokedCount).toBe(2);
    for (const { session } of [laptop, phone]) {
      const stored = await ctx.sessions.findById(session.id.value);
      expect(stored?.toSnapshot()).toMatchObject({
        revokedReason: SessionRevocationReason.SECURITY,
        revokedAt: ctx.clock.now(),
        acceptedByAccountId: ana.accountId,
      });
    }
  });

  it("leaves already revoked sessions and other accounts untouched", async () => {
    const ana = await seedAccount(ctx);
    const { session: loggedOut } = await seedSession(ctx, ana);
    loggedOut.revoke(SessionRevocationReason.LOGOUT, ctx.clock.now());
    await ctx.sessions.save(loggedOut);
    const bruno = await seedAccount(ctx);
    const { session: brunoSession } = await seedSession(ctx, bruno);

    const output = await useCase.execute(
      { accountId: ana.accountId },
      ana.actor,
    );

    expect(output.revokedCount).toBe(0);
    const anaStored = await ctx.sessions.findById(loggedOut.id.value);
    expect(anaStored?.revokedReason).toBe(SessionRevocationReason.LOGOUT);
    const brunoStored = await ctx.sessions.findById(brunoSession.id.value);
    expect(brunoStored?.isRevoked()).toBe(false);
  });

  it("lets an admin revoke someone else's sessions", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    const output = await useCase.execute(
      { accountId: ana.accountId },
      admin.actor,
    );

    expect(output.revokedCount).toBe(1);
    const stored = await ctx.sessions.findById(session.id.value);
    expect(stored?.acceptedByAccountId?.value).toBe(admin.accountId);
  });

  it("throws Forbidden when a regular user targets someone else", async () => {
    const bruno = await seedAccount(ctx);
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    await expectAppError(
      useCase.execute({ accountId: ana.accountId }, bruno.actor),
      IdentityError.Forbidden,
      { actorAccountId: bruno.accountId },
    );

    const stored = await ctx.sessions.findById(session.id.value);
    expect(stored?.isRevoked()).toBe(false);
  });
});
