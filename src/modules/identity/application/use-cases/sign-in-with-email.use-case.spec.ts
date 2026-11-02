import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
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
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import { SignInWithEmailInput } from "./sign-in-with-email.types";
import { SignInWithEmailUseCase } from "./sign-in-with-email.use-case";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

type Arrange = () => Promise<SignInWithEmailInput>;

type FailureCase = readonly [label: string, reason: string, arrange: Arrange];

type ReasonCase = readonly [reason: string, arrange: Arrange];

const LOCK = RateLimitPolicy.SIGN_IN_FAILURES_PER_EMAIL;

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

  const noAccount: Arrange = () =>
    Promise.resolve(makeInput(randomCredentials()));

  const accountWithoutCredential: Arrange = async () => {
    const input = makeInput(randomCredentials());
    await saveAccountOnly(input.email);
    return input;
  };

  const deletedCredential: Arrange = async () => {
    const ana = await seedAccount(ctx);
    ana.credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(ana.credential);
    return makeInput(ana);
  };

  const credentialWithoutPassword: Arrange = async () => {
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
    return makeInput(ana);
  };

  const oauthCredential: Arrange = async () => {
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
    return makeInput(ana);
  };

  const wrongPassword: Arrange = async () => {
    const ana = await seedAccount(ctx);
    return makeInput({ email: ana.email, password: faker.internet.password() });
  };

  const NO_STORED_PASSWORD: readonly FailureCase[] = [
    [
      "no account uses the e-mail",
      IdentityError.AccountNotFound.code,
      noAccount,
    ],
    [
      "the account has no e-mail credential",
      IdentityError.CredentialNotFound.code,
      accountWithoutCredential,
    ],
    [
      "the e-mail credential is deleted",
      IdentityError.CredentialDeleted.code,
      deletedCredential,
    ],
    [
      "the credential has no password hash",
      IdentityError.CredentialPasswordNotSet.code,
      credentialWithoutPassword,
    ],
    [
      "the credential is not an e-mail one",
      IdentityError.PasswordHashNotAllowedForProvider.code,
      oauthCredential,
    ],
  ];

  const INVALID_CREDENTIALS: readonly FailureCase[] = [
    ...NO_STORED_PASSWORD,
    [
      "the password is wrong",
      IdentityError.InvalidCredentials.code,
      wrongPassword,
    ],
  ];

  const failWrongPassword = (email: string) =>
    useCase
      .execute(makeInput({ email, password: faker.internet.password() }))
      .catch(() => undefined);

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

  it.each(NO_STORED_PASSWORD)(
    "throws InvalidCredentials with no stored password: %s",
    async (_, __, arrange) => {
      const input = await arrange();

      await expectAppError(
        useCase.execute(input),
        IdentityError.InvalidCredentials,
      );
    },
  );

  it("throws InvalidCredentials when the password is wrong", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(
        makeInput({ email: ana.email, password: faker.internet.password() }),
      ),
      IdentityError.InvalidCredentials,
    );
  });

  it("throws InvalidCredentials for a deactivated account with a wrong password", async () => {
    const ana = await seedAccount(ctx);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute(
        makeInput({ email: ana.email, password: faker.internet.password() }),
      ),
      IdentityError.InvalidCredentials,
    );
  });

  it.each(NO_STORED_PASSWORD)(
    "verifies the password exactly once against no hash when %s",
    async (_, __, arrange) => {
      const input = await arrange();
      const verify = vi.spyOn(ctx.passwordHasher, "verify");

      await useCase.execute(input).catch(() => undefined);

      expect(verify.mock.calls).toStrictEqual([[input.password, null]]);
    },
  );

  it.each([
    ["right", true],
    ["wrong", false],
  ])(
    "verifies the password exactly once against the stored hash when it is %s",
    async (_, right) => {
      const ana = await seedAccount(ctx);
      const password = right ? ana.password : faker.internet.password();
      const verify = vi.spyOn(ctx.passwordHasher, "verify");

      await useCase
        .execute(makeInput({ email: ana.email, password }))
        .catch(() => undefined);

      expect(verify.mock.calls).toStrictEqual([
        [password, ana.credential.passwordHash?.value],
      ]);
    },
  );

  it.each(INVALID_CREDENTIALS)(
    "records one sign-in failure when %s",
    async (_, __, arrange) => {
      const input = await arrange();
      const recordFailure = vi.spyOn(ctx.signInThrottle, "recordFailure");

      await useCase.execute(input).catch(() => undefined);

      expect(recordFailure.mock.calls).toStrictEqual([[input.email]]);
    },
  );

  it("throws AccountDeleted for a deactivated account with the right password", async () => {
    const ana = await seedAccount(ctx);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.AccountDeleted,
      { accountId: ana.accountId },
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
          passwordHash: await ctx.passwordHasher.hash(input.password),
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
    for (let i = 0; i < LOCK.limit; i++) await failWrongPassword(ana.email);

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.SignInLocked,
      { retryAfterSeconds: LOCK.windowMs / 1000 },
    );
  });

  it("locks an e-mail with no account after too many failures", async () => {
    const { email } = randomCredentials();
    for (let i = 0; i < LOCK.limit; i++) await failWrongPassword(email);

    await expectAppError(
      useCase.execute(
        makeInput({ email, password: faker.internet.password() }),
      ),
      IdentityError.SignInLocked,
      { retryAfterSeconds: LOCK.windowMs / 1000 },
    );
  });

  it("counts the case and spacing variants of an e-mail in the same lock window", async () => {
    const ana = await seedAccount(ctx);
    const variants = [ana.email.toUpperCase(), `  ${ana.email}  `];
    for (let i = 0; i < LOCK.limit; i++) {
      await failWrongPassword(variants[i % variants.length] ?? ana.email);
    }

    await expectAppError(
      useCase.execute(makeInput(ana)),
      IdentityError.SignInLocked,
      { retryAfterSeconds: LOCK.windowMs / 1000 },
    );
  });

  it("forgets the wrong passwords once the right one is used", async () => {
    const ana = await seedAccount(ctx);
    for (let i = 0; i < LOCK.limit - 1; i++) await failWrongPassword(ana.email);
    await useCase.execute(makeInput(ana));
    for (let i = 0; i < LOCK.limit - 1; i++) await failWrongPassword(ana.email);

    const output = await useCase.execute(makeInput(ana));

    expect(output.account.id).toBe(ana.accountId);
  });

  describe("security log", () => {
    it("logs identity.signed_in with the new session", async () => {
      const ana = await seedAccount(ctx);
      const input = makeInput(ana);

      const output = await useCase.execute(input);

      const session = await ctx.sessions.findByTokenHash(
        ctx.tokens.hash(output.refreshToken),
      );
      expect(ctx.logger.entries).toStrictEqual([
        {
          level: LogLevel.INFO,
          event: IdentityUseCaseLogEvent.SignedIn.name,
          fields: {
            accountId: ana.accountId,
            sessionId: session?.id.value,
            provider: AuthProvider.EMAIL,
            ipAddress: input.ipAddress,
          },
        },
      ]);
    });

    it.each(
      INVALID_CREDENTIALS.map(([, reason, arrange]): ReasonCase => [
        reason,
        arrange,
      ]),
    )(
      "logs identity.sign_in_failed with %s as reason",
      async (reason, arrange) => {
        const input = await arrange();

        await useCase.execute(input).catch(() => undefined);

        expect(ctx.logger.entries).toStrictEqual([
          {
            level: LogLevel.WARN,
            event: IdentityUseCaseLogEvent.SignInFailed.name,
            fields: {
              provider: AuthProvider.EMAIL,
              reason,
              ipAddress: input.ipAddress,
              email: input.email,
            },
          },
        ]);
      },
    );

    it("does not log an unexpected failure as a failed sign-in", async () => {
      const ana = await seedAccount(ctx);
      vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(
        new Error(faker.lorem.sentence()),
      );

      await useCase.execute(makeInput(ana)).catch(() => undefined);

      expect(ctx.logger.entries).toStrictEqual([]);
    });
  });
});
