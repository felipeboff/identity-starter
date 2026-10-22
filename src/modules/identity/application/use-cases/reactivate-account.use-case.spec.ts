import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { ReactivateAccountUseCase } from "./reactivate-account.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("ReactivateAccountUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ReactivateAccountUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ReactivateAccountUseCase(ctx);
  });

  it("lets an admin reactivate a deactivated account", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
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
      deletedAt: null,
      updatedAt: ctx.clock.now(),
    });
    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.isDeleted()).toBe(false);
  });

  it("throws Forbidden when a non-admin tries, even on their own account", async () => {
    const ana = await seedAccount(ctx);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute({ accountId: ana.accountId }, ana.actor),
      IdentityError.Forbidden,
      { actorAccountId: ana.accountId },
    );

    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.isDeleted()).toBe(true);
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const missingId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute({ accountId: missingId }, admin.actor),
      IdentityError.AccountNotFound,
      { accountId: missingId },
    );
  });
});
