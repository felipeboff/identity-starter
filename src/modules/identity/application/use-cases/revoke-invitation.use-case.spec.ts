import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { InviteMemberUseCase } from "./invite-member.use-case";
import { RevokeInvitationUseCase } from "./revoke-invitation.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("RevokeInvitationUseCase", () => {
  let ctx: IdentityContext;
  let useCase: RevokeInvitationUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new RevokeInvitationUseCase(ctx);
  });

  const inviteAs = async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const { invitation } = await new InviteMemberUseCase(ctx).execute(
      {
        email: faker.internet.email().toLowerCase(),
        role: MembershipRole.USER,
        permissions: [],
      },
      admin.actor,
    );
    return { admin, invitationId: invitation.id };
  };

  it("revokes the invitation", async () => {
    const { admin, invitationId } = await inviteAs();

    await useCase.execute({ invitationId }, admin.actor);

    expect((await ctx.invitations.findById(invitationId))?.revokedAt).toEqual(
      ctx.clock.now(),
    );
  });

  it("throws InvitationNotFound for an unknown invitation", async () => {
    const { admin } = await inviteAs();
    const invitationId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute({ invitationId }, admin.actor),
      IdentityError.InvitationNotFound,
      { invitationId },
    );
  });

  it("throws Forbidden for an actor who cannot invite", async () => {
    const { invitationId } = await inviteAs();
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ invitationId }, ana.actor),
      IdentityError.Forbidden,
      { actorAccountId: ana.accountId },
    );
  });
});
