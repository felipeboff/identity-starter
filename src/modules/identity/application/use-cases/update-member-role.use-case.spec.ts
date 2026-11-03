import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { UpdateMemberRoleUseCase } from "./update-member-role.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("UpdateMemberRoleUseCase", () => {
  let ctx: IdentityContext;
  let useCase: UpdateMemberRoleUseCase;

  const seedAdmin = () =>
    seedAccount(ctx, {
      permissions: [IdentityPermission.MEMBER_ROLE_UPDATE],
    });

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new UpdateMemberRoleUseCase(ctx);
  });

  it("lets a holder of member.role.update give another member the admin role", async () => {
    const admin = await seedAdmin();
    const ana = await seedAccount(ctx);
    ctx.clock.advance(60_000);

    const output = await useCase.execute(
      { accountId: ana.accountId, role: MembershipRole.ADMIN },
      admin.actor,
    );

    expect(output.membership).toMatchObject({
      accountId: ana.accountId,
      role: MembershipRole.ADMIN,
      updatedAt: ctx.clock.now(),
    });
    const membership = await ctx.memberships.findByAccountId(ana.accountId);
    expect(membership?.role).toBe(MembershipRole.ADMIN);
  });

  it("refuses permission_missing without member.role.update, even with the admin role", async () => {
    const bruno = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(IdentityPermission).filter(
        (permission) => permission !== IdentityPermission.MEMBER_ROLE_UPDATE,
      ),
    });
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(
        { accountId: ana.accountId, role: MembershipRole.ADMIN },
        bruno.actor,
      ),
      SharedError.PermissionMissing,
      { required: IdentityPermission.MEMBER_ROLE_UPDATE },
    );

    const membership = await ctx.memberships.findByAccountId(ana.accountId);
    expect(membership?.role).toBe(MembershipRole.USER);
  });

  it("throws Forbidden when a holder of member.role.update changes their own role", async () => {
    const admin = await seedAdmin();

    await expectAppError(
      useCase.execute(
        { accountId: admin.accountId, role: MembershipRole.ADMIN },
        admin.actor,
      ),
      IdentityError.Forbidden,
      { actorAccountId: admin.accountId },
    );

    const membership = await ctx.memberships.findByAccountId(admin.accountId);
    expect(membership?.role).toBe(MembershipRole.USER);
  });

  it("throws MembershipNotFound when the member does not exist", async () => {
    const admin = await seedAdmin();
    const missingId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute(
        { accountId: missingId, role: MembershipRole.ADMIN },
        admin.actor,
      ),
      IdentityError.MembershipNotFound,
      { accountId: missingId },
    );
  });

  it("throws MembershipDeleted when the member's membership is deleted", async () => {
    const admin = await seedAdmin();
    const ana = await seedAccount(ctx);
    ana.membership.markAsDeleted(ctx.clock.now());
    await ctx.memberships.save(ana.membership);

    await expectAppError(
      useCase.execute(
        { accountId: ana.accountId, role: MembershipRole.ADMIN },
        admin.actor,
      ),
      IdentityError.MembershipDeleted,
      { membershipId: ana.membership.id.value },
    );
  });

  it("throws InvalidMembershipRole when the role is unknown", async () => {
    const admin = await seedAdmin();
    const ana = await seedAccount(ctx);
    const role = faker.string.alpha(12);

    await expectAppError(
      useCase.execute(
        { accountId: ana.accountId, role: role as MembershipRole },
        admin.actor,
      ),
      IdentityError.InvalidMembershipRole,
      { role },
    );
  });
});
