import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { ReactivateAccountUseCase } from "./reactivate-account.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

describe("ReactivateAccountUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ReactivateAccountUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ReactivateAccountUseCase(ctx);
  });

  it("reactivates for a user-role member holding account.reactivate", async () => {
    const admin = await seedAccount(ctx, {
      role: MembershipRole.USER,
      permissions: [MembershipPermission.ACCOUNT_REACTIVATE],
    });
    const ana = await seedAccount(ctx);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);
    ctx.clock.advance(60_000);

    const output = await useCase.execute(
      { accountId: ana.accountId },
      admin.actor,
    );

    expect(output.account).toMatchObject({
      email: ana.email,
      deactivatedAt: null,
    });
    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.isDeleted()).toBe(false);
    expect(account?.updatedAt).toEqual(ctx.clock.now());
  });

  it("refuses permission_missing without account.reactivate, even with the admin role", async () => {
    const ana = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(MembershipPermission).filter(
        (permission) => permission !== MembershipPermission.ACCOUNT_REACTIVATE,
      ),
    });
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute({ accountId: ana.accountId }, ana.actor),
      SharedError.PermissionMissing,
      { required: MembershipPermission.ACCOUNT_REACTIVATE },
    );

    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.isDeleted()).toBe(true);
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    const admin = await seedAccount(ctx, {
      permissions: [MembershipPermission.ACCOUNT_REACTIVATE],
    });
    const missingId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute({ accountId: missingId }, admin.actor),
      IdentityError.AccountNotFound,
      { accountId: missingId },
    );
  });
});
