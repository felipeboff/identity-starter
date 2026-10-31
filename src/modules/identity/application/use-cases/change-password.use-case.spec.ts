import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import { ChangePasswordUseCase } from "./change-password.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("ChangePasswordUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ChangePasswordUseCase;

  const makeGithubCredential = (accountId: string) =>
    Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId,
        provider: AuthProvider.GITHUB,
        subject: faker.string.numeric(8),
      },
      ctx.clock.now(),
    );

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ChangePasswordUseCase(ctx);
  });

  it("updates the password hash and revokes every active session", async () => {
    const ana = await seedAccount(ctx);
    const laptop = await seedSession(ctx, ana);
    const phone = await seedSession(ctx, ana);
    const newPassword = faker.internet.password();

    await useCase.execute(
      { oldPassword: ana.password, newPassword },
      ana.actor,
    );

    const now = ctx.clock.now();
    const credential = await ctx.credentials.findById(ana.credential.id.value);
    expect(credential?.passwordHash?.value).toBe(`$fake$${newPassword}`);
    expect(credential?.updatedAt).toEqual(now);

    for (const { session } of [laptop, phone]) {
      const stored = await ctx.sessions.findById(session.id.value);
      expect(stored?.toSnapshot()).toMatchObject({
        revokedReason: SessionRevocationReason.PASSWORD_CHANGED,
        revokedAt: now,
        acceptedByAccountId: ana.accountId,
      });
    }
  });

  it("ignores OAuth credentials and changes the e-mail one", async () => {
    const ana = await seedAccount(ctx);
    await ctx.credentials.save(makeGithubCredential(ana.accountId));
    const newPassword = faker.internet.password();

    await useCase.execute(
      { oldPassword: ana.password, newPassword },
      ana.actor,
    );

    const credential = await ctx.credentials.findById(ana.credential.id.value);
    expect(credential?.passwordHash?.value).toBe(`$fake$${newPassword}`);
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    // An actor whose account is not stored.
    const ghost = {
      ...(await seedAccount(ctx)).actor,
      accountId: faker.database.mongodbObjectId(),
    };

    await expectAppError(
      useCase.execute(
        {
          oldPassword: faker.internet.password(),
          newPassword: faker.internet.password(),
        },
        ghost,
      ),
      IdentityError.AccountNotFound,
      { accountId: ghost.accountId },
    );
  });

  it("throws CredentialNotFound when the account has no e-mail credential", async () => {
    const ana = await seedAccount(ctx);
    // Simulate an account that only has a GitHub login.
    vi.spyOn(ctx.credentials, "listByAccountId").mockResolvedValue([
      makeGithubCredential(ana.accountId),
    ]);

    await expectAppError(
      useCase.execute(
        { oldPassword: ana.password, newPassword: faker.internet.password() },
        ana.actor,
      ),
      IdentityError.CredentialNotFound,
      { accountId: ana.accountId },
    );
  });

  it("throws CredentialDeleted when the e-mail credential is deleted", async () => {
    const ana = await seedAccount(ctx);
    ana.credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(ana.credential);

    await expectAppError(
      useCase.execute(
        { oldPassword: ana.password, newPassword: faker.internet.password() },
        ana.actor,
      ),
      IdentityError.CredentialDeleted,
      { credentialId: ana.credential.id.value },
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
    vi.spyOn(ctx.credentials, "listByAccountId").mockResolvedValue([
      withoutPassword,
    ]);

    await expectAppError(
      useCase.execute(
        { oldPassword: ana.password, newPassword: faker.internet.password() },
        ana.actor,
      ),
      IdentityError.CredentialPasswordNotSet,
      { credentialId: withoutPassword.id.value },
    );
  });

  it("throws InvalidCredentials and keeps everything when the old password is wrong", async () => {
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    await expectAppError(
      useCase.execute(
        {
          oldPassword: `${ana.password}-wrong`,
          newPassword: faker.internet.password(),
        },
        ana.actor,
      ),
      IdentityError.InvalidCredentials,
      { email: ana.email },
    );

    const credential = await ctx.credentials.findById(ana.credential.id.value);
    expect(credential?.passwordHash?.value).toBe(`$fake$${ana.password}`);
    const stored = await ctx.sessions.findById(session.id.value);
    expect(stored?.isRevoked()).toBe(false);
  });

  it("writes nothing when the last write fails", async () => {
    const ana = await seedAccount(ctx);
    await seedSession(ctx, ana);
    const failure = new Error(faker.lorem.sentence());
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(
      useCase.execute(
        { oldPassword: ana.password, newPassword: faker.internet.password() },
        ana.actor,
      ),
    ).rejects.toBe(failure);

    const credential = await ctx.credentials.findById(ana.credential.id.value);
    expect(credential?.passwordHash?.value).toBe(
      ana.credential.passwordHash?.value,
    );
  });

  it("logs identity.password_changed", async () => {
    const ana = await seedAccount(ctx);

    await useCase.execute(
      { oldPassword: ana.password, newPassword: faker.internet.password() },
      ana.actor,
    );

    expect(ctx.logger.entries).toContainEqual({
      level: LogLevel.INFO,
      event: IdentityUseCaseLogEvent.PasswordChanged.name,
      fields: { accountId: ana.accountId },
    });
  });
});
