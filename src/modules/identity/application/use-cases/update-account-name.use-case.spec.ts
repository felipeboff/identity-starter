import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { UpdateAccountNameUseCase } from "./update-account-name.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("UpdateAccountNameUseCase", () => {
  let ctx: IdentityContext;
  let useCase: UpdateAccountNameUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new UpdateAccountNameUseCase(ctx);
  });

  it("renames the account and saves it", async () => {
    const ana = await seedAccount(ctx);
    const newName = faker.person.fullName();
    ctx.clock.advance(1_000);

    const output = await useCase.execute({ name: newName }, ana.actor);

    const now = ctx.clock.now();
    expect(output.account).toMatchObject({ name: newName, updatedAt: now });
    const stored = await ctx.accounts.findById(ana.accountId);
    expect(stored?.toSnapshot()).toMatchObject({
      name: newName,
      updatedAt: now,
    });
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    // An actor whose account is not stored.
    const ghost = {
      ...(await seedAccount(ctx)).actor,
      accountId: faker.database.mongodbObjectId(),
    };

    await expectAppError(
      useCase.execute({ name: faker.person.fullName() }, ghost),
      IdentityError.AccountNotFound,
      { accountId: ghost.accountId },
    );
  });

  it("throws AccountDeleted when the account is deleted", async () => {
    const ana = await seedAccount(ctx);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute({ name: faker.person.fullName() }, ana.actor),
      IdentityError.AccountDeleted,
      { accountId: ana.accountId },
    );
  });
});
