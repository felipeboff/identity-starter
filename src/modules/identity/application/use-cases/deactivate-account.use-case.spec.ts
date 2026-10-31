import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { DeactivateAccountUseCase } from "./deactivate-account.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("DeactivateAccountUseCase", () => {
  let ctx: IdentityContext;
  let useCase: DeactivateAccountUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new DeactivateAccountUseCase(ctx);
  });

  it("lets the owner deactivate their account and revokes its sessions", async () => {
    const ana = await seedAccount(ctx);
    const phone = await seedSession(ctx, ana);
    const laptop = await seedSession(ctx, ana);
    ctx.clock.advance(60_000);

    await useCase.execute({ accountId: ana.accountId }, ana.actor);

    const now = ctx.clock.now();
    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.deletedAt).toEqual(now);

    for (const { session } of [phone, laptop]) {
      const revoked = await ctx.sessions.findById(session.id.value);
      expect(revoked?.toSnapshot()).toMatchObject({
        revokedReason: SessionRevocationReason.SECURITY,
        revokedAt: now,
        acceptedByAccountId: ana.accountId,
      });
    }
  });

  it("lets a user-role member holding account.deactivate deactivate another account", async () => {
    const admin = await seedAccount(ctx, {
      role: MembershipRole.USER,
      permissions: [MembershipPermission.ACCOUNT_DEACTIVATE],
    });
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    await useCase.execute({ accountId: ana.accountId }, admin.actor);

    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.isDeleted()).toBe(true);

    const revoked = await ctx.sessions.findById(session.id.value);
    expect(revoked?.toSnapshot()).toMatchObject({
      revokedReason: SessionRevocationReason.SECURITY,
      acceptedByAccountId: admin.accountId,
    });
  });

  it("throws Forbidden on someone else's account without account.deactivate, even with the admin role", async () => {
    const bruno = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(MembershipPermission).filter(
        (permission) => permission !== MembershipPermission.ACCOUNT_DEACTIVATE,
      ),
    });
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ accountId: ana.accountId }, bruno.actor),
      IdentityError.Forbidden,
      { actorAccountId: bruno.accountId },
    );

    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.isDeleted()).toBe(false);
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    const admin = await seedAccount(ctx, {
      role: MembershipRole.USER,
      permissions: [MembershipPermission.ACCOUNT_DEACTIVATE],
    });
    const missingId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute({ accountId: missingId }, admin.actor),
      IdentityError.AccountNotFound,
      { accountId: missingId },
    );
  });

  it("writes nothing when the last write fails", async () => {
    const ana = await seedAccount(ctx);
    await seedSession(ctx, ana);
    const failure = new Error(faker.lorem.sentence());
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(
      useCase.execute({ accountId: ana.accountId }, ana.actor),
    ).rejects.toBe(failure);

    expect((await ctx.accounts.findById(ana.accountId))?.isDeleted()).toBe(
      false,
    );
  });
});
