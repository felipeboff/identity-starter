import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";
import { INVITATION_TTL_MS } from "../token.policy";

import { AcceptInvitationUseCase } from "./accept-invitation.use-case";
import { InviteMemberUseCase } from "./invite-member.use-case";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

describe("AcceptInvitationUseCase", () => {
  let ctx: IdentityContext;
  let useCase: AcceptInvitationUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new AcceptInvitationUseCase(ctx);
  });

  const givenInvitation = async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const input = {
      email: faker.internet.email().toLowerCase(),
      role: MembershipRole.ADMIN,
      permissions: [MembershipPermission.INVITE],
    };
    const { invitation } = await new InviteMemberUseCase(ctx).execute(
      input,
      admin.actor,
    );
    const token = ctx.mailer.invitations.at(-1)?.token ?? "";
    return { admin, input, invitationId: invitation.id, token };
  };

  const makeInput = (token: string) => ({
    token,
    name: faker.person.fullName(),
    password: faker.internet.password({ length: 16 }),
    userAgent: faker.internet.userAgent(),
    ipAddress: faker.internet.ip(),
  });

  it("creates a verified account with the invited membership and signs it in", async () => {
    const { admin, input, invitationId, token } = await givenInvitation();
    const accept = makeInput(token);

    const output = await useCase.execute(accept);

    const now = ctx.clock.now();
    const accountId = output.account.id;
    expect(output.account).toMatchObject({
      name: accept.name,
      email: input.email,
      emailVerifiedAt: now,
      createdBy: admin.accountId,
    });
    expect(
      (await ctx.memberships.findByAccountId(accountId))?.toSnapshot(),
    ).toMatchObject({
      role: input.role,
      permissions: input.permissions,
      createdBy: admin.accountId,
    });
    const [credential] = await ctx.credentials.listByAccountId(accountId);
    expect(credential?.toSnapshot()).toMatchObject({
      provider: AuthProvider.EMAIL,
      subject: input.email,
      passwordHash: `$fake$${accept.password}`,
    });
    expect(
      (await ctx.invitations.findById(invitationId))?.toSnapshot(),
    ).toMatchObject({ acceptedAt: now, acceptedByAccountId: accountId });
    expect(output.accessToken).toMatch(`access:${accountId}:`);
  });

  it("throws InvalidInvitationToken for an unknown token", async () => {
    await expectAppError(
      useCase.execute(makeInput(faker.string.alphanumeric(43))),
      IdentityError.InvalidInvitationToken,
    );
  });

  it("throws InvitationAlreadyAccepted the second time", async () => {
    const { token } = await givenInvitation();
    await useCase.execute(makeInput(token));

    await expectAppError(
      useCase.execute(makeInput(token)),
      IdentityError.InvitationAlreadyAccepted,
    );
  });

  it("throws InvitationExpired once the invitation is over", async () => {
    const { token } = await givenInvitation();
    ctx.clock.advance(INVITATION_TTL_MS);

    await expectAppError(
      useCase.execute(makeInput(token)),
      IdentityError.InvitationExpired,
    );
  });

  it("throws AccountEmailTaken when the e-mail got an account meanwhile", async () => {
    const { input, token } = await givenInvitation();
    await seedAccount(ctx, { email: input.email });

    await expectAppError(
      useCase.execute(makeInput(token)),
      IdentityError.AccountEmailTaken,
      { email: input.email },
    );
  });

  it("writes nothing when the last write fails", async () => {
    const { input, invitationId, token } = await givenInvitation();
    const failure = new Error(faker.lorem.sentence());
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(useCase.execute(makeInput(token))).rejects.toBe(failure);

    expect(await ctx.accounts.findByEmail(input.email)).toBeNull();
    expect((await ctx.invitations.findById(invitationId))?.isAccepted()).toBe(
      false,
    );
  });
});
