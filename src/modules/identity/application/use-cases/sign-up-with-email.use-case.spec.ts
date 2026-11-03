import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountRegisteredVia, IdentityEvent } from "../events/identity-event";
import { toOutputAccount } from "../mappers/toOutputAccount";
import { IdentityOutboxEffect } from "../outbox/identity-outbox-effect";
import {
  IdentityContext,
  createIdentityContext,
  recordedEmails,
  seedAccount,
} from "../testing/identity-context";
import { EMAIL_VERIFICATION_TTL_MS } from "../token.policy";

import { SignUpWithEmailUseCase } from "./sign-up-with-email.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("SignUpWithEmailUseCase", () => {
  let ctx: IdentityContext;
  let useCase: SignUpWithEmailUseCase;

  const makeInput = () => ({
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password(),
    userAgent: faker.internet.userAgent(),
    ipAddress: faker.internet.ip(),
  });

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new SignUpWithEmailUseCase(ctx);
  });

  const spyOnPublished = (email: string) => {
    const publish = ctx.outbox.publish.bind(ctx.outbox);
    const seen: { type: string; running: boolean; accountStored: boolean }[] =
      [];
    vi.spyOn(ctx.outbox, "publish").mockImplementation(async (message) => {
      seen.push({
        type: message.type,
        running: ctx.transactions.isRunning(),
        accountStored: (await ctx.accounts.findByEmail(email)) !== null,
      });
      return publish(message);
    });
    return seen;
  };

  it("creates the account with an e-mail credential, a user membership and a session", async () => {
    const input = makeInput();

    const output = await useCase.execute(input);

    const accountId = output.account.id;
    expect(output.account).toMatchObject({
      name: input.name,
      email: input.email,
      deactivatedAt: null,
    });
    expect((await ctx.accounts.findById(accountId))?.createdBy.value).toBe(
      accountId,
    );

    const [credential] = await ctx.credentials.listByAccountId(accountId);
    expect(credential.toSnapshot()).toMatchObject({
      provider: AuthProvider.EMAIL,
      subject: input.email,
      passwordHash: `$fake$${input.password}`,
    });

    const membership = await ctx.memberships.findByAccountId(accountId);
    expect(membership?.toSnapshot()).toMatchObject({
      role: MembershipRole.USER,
      permissions: [],
    });

    const session = await ctx.sessions.findByTokenHash(
      ctx.tokens.hash(output.refreshToken),
    );
    expect(session?.toSnapshot()).toMatchObject({
      accountId,
      credentialId: credential.id.value,
      membershipId: membership?.id.value,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
    expect(output.accessToken).toBe(`access:${accountId}:${session?.id.value}`);
  });

  it("throws AccountEmailTaken when an account already uses the e-mail", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ ...makeInput(), email: ana.email }),
      IdentityError.AccountEmailTaken,
      { email: ana.email },
    );
  });

  it("throws CredentialEmailTaken when a credential already uses the e-mail", async () => {
    const email = faker.internet.email().toLowerCase();
    // A credential whose account no longer exists still blocks the e-mail.
    const orphan = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        provider: AuthProvider.EMAIL,
        subject: email,
        providerEmail: email,
        passwordHash: `$fake$${faker.internet.password()}`,
      },
      ctx.clock.now(),
    );
    await ctx.credentials.save(orphan);

    await expectAppError(
      useCase.execute({ ...makeInput(), email }),
      IdentityError.CredentialEmailTaken,
      { email },
    );
  });

  it("writes nothing when the last write fails", async () => {
    const input = makeInput();
    const failure = new Error(faker.lorem.sentence());
    const memberships = vi.spyOn(ctx.memberships, "save");
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(useCase.execute(input)).rejects.toBe(failure);

    const [membership] = memberships.mock.calls[0];
    expect(await ctx.accounts.findByEmail(input.email)).toBeNull();
    expect(await ctx.credentials.findByEmail(input.email)).toBeNull();
    expect(await ctx.memberships.findById(membership.id.value)).toBeNull();
    expect(ctx.outbox.events()).toStrictEqual([]);
  });

  it("returns the account as it was stored", async () => {
    const output = await useCase.execute(makeInput());

    const stored = await ctx.accounts.findById(output.account.id);
    expect(stored && toOutputAccount(stored)).toStrictEqual(output.account);
  });

  it("records the verification e-mail in the outbox instead of sending it", async () => {
    const input = makeInput();
    const expiresAt = new Date(
      ctx.clock.now().getTime() + EMAIL_VERIFICATION_TTL_MS,
    );

    const output = await useCase.execute(input);

    expect(ctx.outbox.effects()).toStrictEqual([
      expect.objectContaining({
        type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
        payload: {
          to: input.email,
          name: input.name,
          token: expect.any(String) as string,
          expiresAt,
        },
      }),
    ]);
    expect(ctx.mailer.emailVerifications).toStrictEqual([]);
    expect(ctx.logger.entries).toStrictEqual([]);

    const [sent] = recordedEmails(
      ctx,
      IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
    );
    const verification = await ctx.emailVerifications.findByTokenHash(
      ctx.tokens.hash(sent.token),
    );
    expect(verification?.toSnapshot()).toMatchObject({
      accountId: output.account.id,
      expiresAt,
      consumedAt: null,
    });
  });

  it("publishes identity.account.registered in the account's transaction", async () => {
    const input = makeInput();
    const seen = spyOnPublished(input.email);

    const output = await useCase.execute(input);

    expect(seen).toContainEqual({
      type: IdentityEvent.ACCOUNT_REGISTERED,
      running: true,
      accountStored: true,
    });
    expect(
      ctx.outbox.events().map(({ type, payload }) => ({ type, payload })),
    ).toStrictEqual([
      {
        type: IdentityEvent.ACCOUNT_REGISTERED,
        payload: {
          accountId: output.account.id,
          email: input.email,
          name: input.name,
          registeredVia: AccountRegisteredVia.SIGN_UP,
        },
      },
    ]);
  });

  it("records the e-mail inside the sign-up transaction", async () => {
    const input = makeInput();
    const seen = spyOnPublished(input.email);

    await useCase.execute(input);

    expect(seen).toContainEqual({
      type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
      running: true,
      accountStored: true,
    });
  });
});
