import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { InviteMemberUseCase } from "./invite-member.use-case";
import { ListInvitationsUseCase } from "./list-invitations.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
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
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const older = await invite(admin.actor);
    ctx.clock.advance(1_000);
    const newer = await invite(admin.actor);
    const revoked = await invite(admin.actor);
    const stored = await ctx.invitations.findById(revoked.invitation.id);
    stored?.revoke(ctx.clock.now());
    if (stored) await ctx.invitations.save(stored);

    const output = await useCase.execute(admin.actor);

    expect(output.invitations).toStrictEqual([
      newer.invitation,
      older.invitation,
    ]);
  });

  it("throws Forbidden for an actor who cannot invite", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(useCase.execute(ana.actor), IdentityError.Forbidden, {
      actorAccountId: ana.accountId,
    });
  });
});
