import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
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

const ADMIN_PERMISSIONS = [
  MembershipPermission.MEMBER_PERMISSIONS_UPDATE,
  MembershipPermission.INVITATION_READ,
  MembershipPermission.INVITATION_REVOKE,
];

describe("UpdateMemberPermissionsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: UpdateMemberPermissionsUseCase;

  const seedAdmin = () =>
    seedAccount(ctx, { permissions: [...ADMIN_PERMISSIONS] });

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new UpdateMemberPermissionsUseCase(ctx);
  });

  it("lets a holder of member.permissions.update replace another member's permissions", async () => {
    const admin = await seedAdmin();
    const ana = await seedAccount(ctx);
    ctx.clock.advance(60_000);

    const output = await useCase.execute(
      {
        accountId: ana.accountId,
        permissions: [
          MembershipPermission.INVITATION_READ,
          MembershipPermission.INVITATION_REVOKE,
        ],
      },
      admin.actor,
    );

    expect(output.membership).toMatchObject({
      accountId: ana.accountId,
      permissions: [
        MembershipPermission.INVITATION_READ,
        MembershipPermission.INVITATION_REVOKE,
      ],
      updatedAt: ctx.clock.now(),
    });
    const membership = await ctx.memberships.findByAccountId(ana.accountId);
    expect(membership?.permissions).toEqual([
      MembershipPermission.INVITATION_READ,
      MembershipPermission.INVITATION_REVOKE,
    ]);
  });

  it("throws Forbidden when the actor changes their own permissions", async () => {
    const admin = await seedAdmin();

    await expectAppError(
      useCase.execute(
        { accountId: admin.accountId, permissions: [] },
        admin.actor,
      ),
      IdentityError.Forbidden,
      { actorAccountId: admin.accountId },
    );

    const membership = await ctx.memberships.findByAccountId(admin.accountId);
    expect(membership?.permissions).toEqual(ADMIN_PERMISSIONS);
  });

  it("keeps the member's permissions the actor does not hold as they are", async () => {
    const admin = await seedAdmin();
    const ana = await seedAccount(ctx, {
      permissions: [MembershipPermission.SESSION_REVOKE],
    });
    const permissions = [
      MembershipPermission.SESSION_REVOKE,
      MembershipPermission.INVITATION_READ,
    ];

    const output = await useCase.execute(
      { accountId: ana.accountId, permissions },
      admin.actor,
    );

    expect(output.membership.permissions).toEqual(permissions);
  });

  it.each([
    ["grants", [], [MembershipPermission.SESSION_REVOKE]],
    ["removes", [MembershipPermission.SESSION_REVOKE], []],
  ])(
    "throws Forbidden and saves nothing when the actor %s a permission they do not hold",
    async (_, current, requested) => {
      const admin = await seedAdmin();
      const ana = await seedAccount(ctx, { permissions: current });

      await expectAppError(
        useCase.execute(
          { accountId: ana.accountId, permissions: requested },
          admin.actor,
        ),
        IdentityError.Forbidden,
        { actorAccountId: admin.accountId },
      );

      const membership = await ctx.memberships.findByAccountId(ana.accountId);
      expect(membership?.permissions).toEqual(current);
    },
  );

  it("refuses permission_missing without member.permissions.update, even with the admin role", async () => {
    const bruno = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(MembershipPermission).filter(
        (permission) =>
          permission !== MembershipPermission.MEMBER_PERMISSIONS_UPDATE,
      ),
    });
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(
        {
          accountId: ana.accountId,
          permissions: [MembershipPermission.MEMBER_PERMISSIONS_UPDATE],
        },
        bruno.actor,
      ),
      SharedError.PermissionMissing,
      { required: MembershipPermission.MEMBER_PERMISSIONS_UPDATE },
    );

    const membership = await ctx.memberships.findByAccountId(ana.accountId);
    expect(membership?.permissions).toEqual([]);
  });

  it("throws MembershipNotFound when the member does not exist", async () => {
    const admin = await seedAdmin();
    const missingId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute({ accountId: missingId, permissions: [] }, admin.actor),
      IdentityError.MembershipNotFound,
      { accountId: missingId },
    );
  });

  it("throws InvalidMembershipPermissions when a permission is unknown", async () => {
    const admin = await seedAdmin();
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
