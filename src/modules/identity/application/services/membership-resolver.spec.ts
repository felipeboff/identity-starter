import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("MembershipResolver", () => {
  let ctx: IdentityContext;

  beforeEach(() => {
    ctx = createIdentityContext();
  });

  describe("resolveActive", () => {
    it("returns the membership when it is active", async () => {
      const ana = await seedAccount(ctx);

      const membership = await ctx.membershipResolver.resolveActive(
        ana.accountId,
      );

      expect(membership.id.value).toBe(ana.membership.id.value);
    });

    it("throws MembershipNotFound when the account has no membership", async () => {
      const accountId = faker.database.mongodbObjectId();

      await expectAppError(
        ctx.membershipResolver.resolveActive(accountId),
        IdentityError.MembershipNotFound,
        { accountId },
      );
    });

    it("throws MembershipDeleted when the membership is deleted", async () => {
      const ana = await seedAccount(ctx);
      ana.membership.markAsDeleted(ctx.clock.now());
      await ctx.memberships.save(ana.membership);

      await expectAppError(
        ctx.membershipResolver.resolveActive(ana.accountId),
        IdentityError.MembershipDeleted,
        { membershipId: ana.membership.id.value },
      );
    });
  });
});
