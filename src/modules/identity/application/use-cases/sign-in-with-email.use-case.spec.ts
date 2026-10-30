import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toOutputAccount } from "../mappers/toOutputAccount";
import { RateLimitPolicy } from "../rate-limit.policy";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { SignInWithEmailUseCase } from "./sign-in-with-email.use-case";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("SignInWithEmailUseCase", () => {
  let ctx: IdentityContext;
  let useCase: SignInWithEmailUseCase;

  const makeInput = (credentials: { email: string; password: string }) => ({
    ...credentials,
    userAgent: faker.internet.userAgent(),
    ipAddress: faker.internet.ip(),
  });

  const randomCredentials = () => ({
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password(),
  });

  /** An account with the given e-mail and no credential at all. */
  const saveAccountOnly = async (email: string) => {
    const accountId = faker.database.mongodbObjectId();
    await ctx.accounts.save(
      Account.register(
        {
          id: accountId,
          name: faker.person.fullName(),
          email,
          createdBy: accountId,
        },
        ctx.clock.now(),
      ),
    );
    return accountId;
  };

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new SignInWithEmailUseCase(ctx);
  });

  it("opens a session and marks the account as last seen", async () => {
    const ana = await seedAccount(ctx);
    const input = makeInput(ana);

    const output = await useCase.execute(input);

    const now = ctx.clock.now();
    expect(output.account).toMatchObject({
      id: ana.accountId,
      lastSeenAt: now,
    });
    const stored = await ctx.accounts.findById(ana.accountId);
    expect(stored?.lastSeenAt).toEqual(now);

    const session = await ctx.sessions.findByTokenHash(
      ctx.tokens.hash(output.refreshToken),
    );
    expect(session?.toSnapshot()).toMatchObject({
      accountId: ana.accountId,
      credentialId: ana.credential.id.value,
      membershipId: ana.membership.id.value,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      revokedAt: null,
    });
    expect(output.accessToken).toBe(
      `access:${ana.accountId}:${session?.id.value}`,
    );
  });

  it("keeps the other sessions of the account active", async () => {
    const ana = await seedAccount(ctx);
    const { session: previous } = await seedSession(ctx, ana);

    await useCase.execute(makeInput(ana));

    const now = ctx.clock.now();
    const sessions = await ctx.sessions.listByAccountId(ana.accountId);
    expect(sessions.filter((session) => session.isActive(now))).toHaveLength(2);
    expect(
      (await ctx.sessions.findById(previous.id.value))?.isActive(now),
    ).toBe(true);
  });

  it("throws AccountNotFound when no account uses the e-mail", async () => {
    const input = makeInput(randomCredentials());

    await expectAppError(
      useCase.execute(input),
      IdentityError.AccountNotFound,
      { email: input.email },
    );
  });

  it("throws AccountDeleted when the account is deleted", async () => {
    const ana = await seedAccount(ctx);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.AccountDeleted,
      { accountId: ana.accountId },
    );
  });

  it("throws CredentialNotFound when the account has no e-mail credential", async () => {
    const input = makeInput(randomCredentials());
    await saveAccountOnly(input.email);

    await expectAppError(
      useCase.execute(input),
      IdentityError.CredentialNotFound,
      { email: input.email },
    );
  });

  it("throws CredentialDeleted when the credential is deleted", async () => {
    const ana = await seedAccount(ctx);
    ana.credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(ana.credential);

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.CredentialDeleted,
      { credentialId: ana.credential.id.value },
    );
  });

  it("throws CredentialAccountMismatch when the credential belongs to another account", async () => {
    const input = makeInput(randomCredentials());
    const anaId = await saveAccountOnly(input.email);
    const brunoId = faker.database.mongodbObjectId();
    await ctx.credentials.save(
      Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: brunoId,
          provider: AuthProvider.EMAIL,
          subject: input.email,
          providerEmail: input.email,
          passwordHash: `$fake$${input.password}`,
        },
        ctx.clock.now(),
      ),
    );

    await expectAppError(
      useCase.execute(input),
      IdentityError.CredentialAccountMismatch,
      { accountId: anaId, credentialAccountId: brunoId },
    );
  });

  it("throws PasswordHashNotAllowedForProvider when the credential is not an e-mail one", async () => {
    const ana = await seedAccount(ctx);
    const google = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId: ana.accountId,
        provider: AuthProvider.GOOGLE,
        subject: faker.string.numeric(21),
        providerEmail: ana.email,
      },
      ctx.clock.now(),
    );
    // The in-memory findByEmail only returns e-mail credentials.
    vi.spyOn(ctx.credentials, "findByEmail").mockResolvedValue(google);

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.PasswordHashNotAllowedForProvider,
      { provider: AuthProvider.GOOGLE },
    );
  });

  it("throws CredentialPasswordNotSet when the credential has no password hash", async () => {
    const ana = await seedAccount(ctx);
    const now = ctx.clock.now();
    const withoutPassword = Credential.restore({
      id: faker.database.mongodbObjectId(),
      accountId: ana.accountId,
      provider: AuthProvider.EMAIL,
      subject: ana.email,
      providerEmail: ana.email,
      passwordHash: "",
      createdAt: now,
      updatedAt: now,
      version: 0,
      deletedAt: null,
    });
    // The in-memory repo cannot persist an e-mail credential without a hash.
    vi.spyOn(ctx.credentials, "findByEmail").mockResolvedValue(withoutPassword);

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.CredentialPasswordNotSet,
      { credentialId: withoutPassword.id.value },
    );
  });

  it("throws InvalidCredentials when the password is wrong", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(
        makeInput({ email: ana.email, password: `${ana.password}-wrong` }),
      ),
      IdentityError.InvalidCredentials,
      { email: ana.email },
    );
  });

  it("throws MembershipNotFound when the account has no membership", async () => {
    const ana = await seedAccount(ctx);
    // Repositories have no delete: simulate an entity that is gone.
    vi.spyOn(ctx.memberships, "findByAccountId").mockResolvedValue(null);

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.MembershipNotFound,
      { accountId: ana.accountId },
    );
  });

  it("throws MembershipDeleted when the membership is deleted", async () => {
    const ana = await seedAccount(ctx);
    ana.membership.markAsDeleted(ctx.clock.now());
    await ctx.memberships.save(ana.membership);

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.MembershipDeleted,
      { membershipId: ana.membership.id.value },
    );
  });

  it("writes nothing when the last write fails", async () => {
    const ana = await seedAccount(ctx);
    const failure = new Error(faker.lorem.sentence());
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(
      useCase.execute(makeInput({ email: ana.email, password: ana.password })),
    ).rejects.toBe(failure);

    expect((await ctx.accounts.findById(ana.accountId))?.lastSeenAt).toBeNull();
    expect(await ctx.sessions.listByAccountId(ana.accountId)).toStrictEqual([]);
  });

  it("returns the account as it was stored", async () => {
    const ana = await seedAccount(ctx);

    const output = await useCase.execute(makeInput(ana));

    const stored = await ctx.accounts.findById(ana.accountId);
    expect(stored && toOutputAccount(stored)).toStrictEqual(output.account);
  });

  it("locks the e-mail after too many wrong passwords, even with the right one", async () => {
    const ana = await seedAccount(ctx);
    const limit = RateLimitPolicy.SIGN_IN_FAILURES_PER_EMAIL.limit;
    for (let i = 0; i < limit; i++) {
      await useCase
        .execute(
          makeInput({ email: ana.email, password: `${ana.password}-wrong` }),
        )
        .catch(() => undefined);
    }

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.SignInLocked,
      {
        retryAfterSeconds:
          RateLimitPolicy.SIGN_IN_FAILURES_PER_EMAIL.windowMs / 1000,
      },
    );
  });

  it("forgets the wrong passwords once the right one is used", async () => {
    const ana = await seedAccount(ctx);
    const limit = RateLimitPolicy.SIGN_IN_FAILURES_PER_EMAIL.limit;
    const wrong = () =>
      useCase
        .execute(
          makeInput({ email: ana.email, password: `${ana.password}-wrong` }),
        )
        .catch(() => undefined);
    for (let i = 0; i < limit - 1; i++) await wrong();
    await useCase.execute(makeInput(ana));
    for (let i = 0; i < limit - 1; i++) await wrong();

    const output = await useCase.execute(makeInput(ana));

    expect(output.account.id).toBe(ana.accountId);
  });
});
