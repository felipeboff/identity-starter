import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { UpdateMemberPermissionsUseCase } from "./update-member-permissions.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

describe("UpdateMemberPermissionsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: UpdateMemberPermissionsUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new UpdateMemberPermissionsUseCase(ctx);
  });

  it("lets an admin replace another member's permissions", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const ana = await seedAccount(ctx);
    ctx.clock.advance(60_000);

    const output = await useCase.execute(
      {
        accountId: ana.accountId,
        permissions: [MembershipPermission.READ, MembershipPermission.WRITE],
      },
      admin.actor,
    );

    expect(output.membership).toMatchObject({
      accountId: ana.accountId,
      permissions: [MembershipPermission.READ, MembershipPermission.WRITE],
      updatedAt: ctx.clock.now(),
    });
    const membership = await ctx.memberships.findByAccountId(ana.accountId);
    expect(membership?.permissions).toEqual([
      MembershipPermission.READ,
      MembershipPermission.WRITE,
    ]);
  });

  it("lets an admin update their own permissions", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });

    const output = await useCase.execute(
      { accountId: admin.accountId, permissions: [MembershipPermission.ADMIN] },
      admin.actor,
    );

    expect(output.membership.permissions).toEqual([MembershipPermission.ADMIN]);
  });

  it("throws Forbidden when the actor is not an admin", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(
        { accountId: ana.accountId, permissions: [MembershipPermission.ADMIN] },
        ana.actor,
      ),
      IdentityError.Forbidden,
      { actorAccountId: ana.accountId },
    );

    const membership = await ctx.memberships.findByAccountId(ana.accountId);
    expect(membership?.permissions).toEqual([]);
  });

  it("throws MembershipNotFound when the member does not exist", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const missingId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute({ accountId: missingId, permissions: [] }, admin.actor),
      IdentityError.MembershipNotFound,
      { accountId: missingId },
    );
  });

  it("throws InvalidMembershipPermissions when a permission is unknown", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const ana = await seedAccount(ctx);
    const permission = faker.string.alpha(12);

    await expectAppError(
      useCase.execute(
        {
          accountId: ana.accountId,
          permissions: [permission as MembershipPermission],
        },
        admin.actor,
      ),
      IdentityError.InvalidMembershipPermissions,
      { permissions: [permission] },
    );
  });
});
