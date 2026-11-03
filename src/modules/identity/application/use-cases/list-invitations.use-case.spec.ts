import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { InviteMemberUseCase } from "./invite-member.use-case";
import { ListInvitationsUseCase } from "./list-invitations.use-case";

import { IdentityPermission } from "@/identity/domain/identity.permission";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("ListInvitationsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ListInvitationsUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ListInvitationsUseCase(ctx);
  });

  const invite = (actor: Parameters<InviteMemberUseCase["execute"]>[1]) =>
    new InviteMemberUseCase(ctx).execute(
      {
        email: faker.internet.email().toLowerCase(),
        role: MembershipRole.USER,
        permissions: [],
      },
      actor,
    );

  it("lists the pending invitations, newest first, without token hashes", async () => {
    const inviter = await seedAccount(ctx, {
      permissions: [
        IdentityPermission.INVITATION_CREATE,
        IdentityPermission.INVITATION_READ,
      ],
    });
    const older = await invite(inviter.actor);
    ctx.clock.advance(1_000);
    const newer = await invite(inviter.actor);
    const revoked = await invite(inviter.actor);
    const stored = await ctx.invitations.findById(revoked.invitation.id);
    stored?.revoke(ctx.clock.now());
    if (stored) await ctx.invitations.save(stored);

    const output = await useCase.execute(inviter.actor);

    expect(output.invitations).toStrictEqual([
      newer.invitation,
      older.invitation,
    ]);
  });

  it("refuses permission_missing without invitation.read, even with the admin role", async () => {
    const ana = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(IdentityPermission).filter(
        (permission) => permission !== IdentityPermission.INVITATION_READ,
      ),
    });

    await expectAppError(
      useCase.execute(ana.actor),
      SharedError.PermissionMissing,
      { required: IdentityPermission.INVITATION_READ },
    );
  });
});
