import { faker } from "@faker-js/faker";
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
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

describe("InviteMemberUseCase", () => {
  let ctx: IdentityContext;
  let useCase: InviteMemberUseCase;

  const makeInput = () => ({
    email: faker.internet.email().toLowerCase(),
    role: MembershipRole.USER,
    permissions: [MembershipPermission.READ],
  });

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new InviteMemberUseCase(ctx);
  });

  it("stores a pending invitation and e-mails its link", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const input = makeInput();

    const output = await useCase.execute(input, admin.actor);

    const expiresAt = new Date(ctx.clock.now().getTime() + INVITATION_TTL_MS);
    const stored = await ctx.invitations.findById(output.invitation.id);
    expect(stored?.toSnapshot()).toMatchObject({
      email: input.email,
      role: input.role,
      permissions: input.permissions,
      createdBy: admin.accountId,
      expiresAt,
    });
    expect(ctx.mailer.invitations).toStrictEqual([
      {
        to: input.email,
        inviterName: admin.account.name,
        token: expect.any(String) as unknown,
        expiresAt,
      },
    ]);
    expect(stored?.tokenHash.value).toBe(
      ctx.tokens.hash(ctx.mailer.invitations[0]?.token ?? ""),
    );
  });

  it("revokes the pending invitation the e-mail already had", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const input = makeInput();
    const first = await useCase.execute(input, admin.actor);

    await useCase.execute(input, admin.actor);

    expect(
      (await ctx.invitations.findById(first.invitation.id))?.isRevoked(),
    ).toBe(true);
  });

  it("throws AccountEmailTaken for an e-mail that already has an account", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ ...makeInput(), email: ana.email }, admin.actor),
      IdentityError.AccountEmailTaken,
      { email: ana.email },
    );
  });

  it("throws Forbidden for an actor who cannot invite", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(makeInput(), ana.actor),
      IdentityError.Forbidden,
      { actorAccountId: ana.accountId },
    );
  });

  it("throws Forbidden when a user grants more than they have", async () => {
    const inviter = await seedAccount(ctx, {
      permissions: [MembershipPermission.INVITE],
    });

    await expectAppError(
      useCase.execute(makeInput(), inviter.actor),
      IdentityError.Forbidden,
      { actorAccountId: inviter.accountId },
    );
  });
});
