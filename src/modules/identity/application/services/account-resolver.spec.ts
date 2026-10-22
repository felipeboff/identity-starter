import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("AccountResolver", () => {
  let ctx: IdentityContext;

  beforeEach(() => {
    ctx = createIdentityContext();
  });

  describe("resolveActive", () => {
    it("returns the account when it is active", async () => {
      const ana = await seedAccount(ctx);

      const account = await ctx.accountResolver.resolveActive(ana.accountId);

      expect(account.id.value).toBe(ana.accountId);
    });

    it("throws AccountNotFound when the account does not exist", async () => {
      const accountId = faker.database.mongodbObjectId();

      await expectAppError(
        ctx.accountResolver.resolveActive(accountId),
        IdentityError.AccountNotFound,
        { accountId },
      );
    });

    it("throws AccountDeleted when the account is deleted", async () => {
      const ana = await seedAccount(ctx);
      ana.account.markAsDeleted(ctx.clock.now());
      await ctx.accounts.save(ana.account);

      await expectAppError(
        ctx.accountResolver.resolveActive(ana.accountId),
        IdentityError.AccountDeleted,
        { accountId: ana.accountId },
      );
    });
  });
});
