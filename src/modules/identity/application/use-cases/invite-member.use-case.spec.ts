import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";
import { INVITATION_TTL_MS } from "../token.policy";

import { InviteMemberUseCase } from "./invite-member.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("InviteMemberUseCase", () => {
  let ctx: IdentityContext;
  let useCase: InviteMemberUseCase;

  const makeInput = () => ({
    email: faker.internet.email().toLowerCase(),
    role: MembershipRole.USER,
    permissions: [IdentityPermission.INVITATION_READ],
  });

  const seedInviter = () =>
    seedAccount(ctx, {
      permissions: [
        IdentityPermission.INVITATION_CREATE,
        IdentityPermission.INVITATION_READ,
      ],
    });

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new InviteMemberUseCase(ctx);
  });

  it("stores a pending invitation and e-mails its link", async () => {
    const inviter = await seedInviter();
    const input = makeInput();

    const output = await useCase.execute(input, inviter.actor);

    const expiresAt = new Date(ctx.clock.now().getTime() + INVITATION_TTL_MS);
    const stored = await ctx.invitations.findById(output.invitation.id);
    expect(stored?.toSnapshot()).toMatchObject({
      email: input.email,
      role: input.role,
      permissions: input.permissions,
      createdBy: inviter.accountId,
      expiresAt,
    });
    expect(ctx.mailer.invitations).toStrictEqual([
      {
        to: input.email,
        inviterName: inviter.account.name,
        token: expect.any(String) as unknown,
        expiresAt,
      },
    ]);
    expect(stored?.tokenHash.value).toBe(
      ctx.tokens.hash(ctx.mailer.invitations[0]?.token ?? ""),
    );
  });

  it("revokes the pending invitation the e-mail already had", async () => {
    const inviter = await seedInviter();
    const input = makeInput();
    const first = await useCase.execute(input, inviter.actor);

    await useCase.execute(input, inviter.actor);

    expect(
      (await ctx.invitations.findById(first.invitation.id))?.isRevoked(),
    ).toBe(true);
  });

  it("throws AccountEmailTaken for an e-mail that already has an account", async () => {
    const inviter = await seedInviter();
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ ...makeInput(), email: ana.email }, inviter.actor),
      IdentityError.AccountEmailTaken,
      { email: ana.email },
    );
  });

  it("refuses permission_missing without invitation.create, even with the admin role", async () => {
    const ana = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(IdentityPermission).filter(
        (permission) => permission !== IdentityPermission.INVITATION_CREATE,
      ),
    });

    await expectAppError(
      useCase.execute(makeInput(), ana.actor),
      SharedError.PermissionMissing,
      { required: IdentityPermission.INVITATION_CREATE },
    );
    expect(ctx.mailer.invitations).toStrictEqual([]);
  });

  it("throws Forbidden when the inviter grants a permission they do not hold", async () => {
    const inviter = await seedAccount(ctx, {
      permissions: [IdentityPermission.INVITATION_CREATE],
    });

    await expectAppError(
      useCase.execute(makeInput(), inviter.actor),
      IdentityError.Forbidden,
      { actorAccountId: inviter.accountId },
    );
  });

  it("invites with the admin role within the inviter's own permissions", async () => {
    const inviter = await seedInviter();
    const input = { ...makeInput(), role: MembershipRole.ADMIN };

    const output = await useCase.execute(input, inviter.actor);

    expect(output.invitation).toMatchObject({
      role: MembershipRole.ADMIN,
      permissions: input.permissions,
    });
  });

  it("throws Forbidden when the inviter lacks one asked permission, whatever else they hold", async () => {
    const inviter = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(IdentityPermission).filter(
        (permission) => permission !== IdentityPermission.INVITATION_REVOKE,
      ),
    });
    const input = {
      ...makeInput(),
      permissions: Object.values(IdentityPermission),
    };

    await expectAppError(
      useCase.execute(input, inviter.actor),
      IdentityError.Forbidden,
      { actorAccountId: inviter.accountId },
    );
    expect(ctx.mailer.invitations).toStrictEqual([]);
  });

  it("grants a permission another module declares", async () => {
    const [permission] = ctx.otherModulePermissions.permissions;
    const inviter = await seedAccount(ctx, {
      permissions: [IdentityPermission.INVITATION_CREATE, permission],
    });
    const input = { ...makeInput(), permissions: [permission] };

    const output = await useCase.execute(input, inviter.actor);

    expect(output.invitation.permissions).toStrictEqual([permission]);
  });

  it("throws InvalidMembershipPermissions for a code outside the catalog before Forbidden", async () => {
    const inviter = await seedInviter();
    const unknown = `${faker.string.alpha({ length: 10, casing: "lower" })}.${faker.string.alpha({ length: 10, casing: "lower" })}`;
    const input = {
      ...makeInput(),
      permissions: [IdentityPermission.MEMBER_READ, unknown],
    };

    await expectAppError(
      useCase.execute(input, inviter.actor),
      IdentityError.InvalidMembershipPermissions,
      { permissions: [unknown] },
    );
    expect(ctx.mailer.invitations).toStrictEqual([]);
  });
});
