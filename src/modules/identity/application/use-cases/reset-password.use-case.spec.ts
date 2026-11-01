import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IdentityContext,
  SeededAccount,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";
import { PASSWORD_RESET_TTL_MS } from "../token.policy";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import { ResetPasswordUseCase } from "./reset-password.use-case";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { PasswordReset } from "@/identity/domain/password-reset.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("ResetPasswordUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ResetPasswordUseCase;

  /** Saves a pending reset for the account; returns it with its plain token. */
  const saveReset = async (owner: Pick<SeededAccount, "accountId">) => {
    const token = faker.string.alphanumeric(32);
    const reset = PasswordReset.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId: owner.accountId,
        tokenHash: ctx.tokens.hash(token),
        expiresAt: new Date(ctx.clock.now().getTime() + PASSWORD_RESET_TTL_MS),
      },
      ctx.clock.now(),
    );
    await ctx.passwordResets.save(reset);
    return { reset, token };
  };

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ResetPasswordUseCase(ctx);
  });

  it("consumes the token, swaps the password and revokes every session", async () => {
    const ana = await seedAccount(ctx);
    const { token } = await saveReset(ana);
    const phone = await seedSession(ctx, ana);
    const laptop = await seedSession(ctx, ana);
    const newPassword = faker.internet.password();
    const now = ctx.clock.now();

    await useCase.execute({ token, newPassword });

    const credential = await ctx.credentials.findById(ana.credential.id.value);
    expect(credential?.passwordHash?.value).toBe(
      await ctx.passwordHasher.hash(newPassword),
    );

    const reset = await ctx.passwordResets.findByTokenHash(
      ctx.tokens.hash(token),
    );
    expect(reset?.consumedAt).toEqual(now);

    for (const { session } of [phone, laptop]) {
      const revoked = await ctx.sessions.findById(session.id.value);
      expect(revoked?.toSnapshot()).toMatchObject({
        revokedReason: SessionRevocationReason.PASSWORD_CHANGED,
        revokedAt: now,
        acceptedByAccountId: null,
      });
    }
  });

  it("throws InvalidPasswordResetToken when the token is unknown", async () => {
    await expectAppError(
      useCase.execute({
        token: faker.string.alphanumeric(32),
        newPassword: faker.internet.password(),
      }),
      IdentityError.InvalidPasswordResetToken,
    );
  });

  it("throws PasswordResetAlreadyConsumed when the token was already used", async () => {
    const { reset, token } = await saveReset(await seedAccount(ctx));
    reset.consume(ctx.clock.now());
    await ctx.passwordResets.save(reset);

    await expectAppError(
      useCase.execute({ token, newPassword: faker.internet.password() }),
      IdentityError.PasswordResetAlreadyConsumed,
    );
  });

  it("throws PasswordResetExpired once the TTL has passed", async () => {
    const { token } = await saveReset(await seedAccount(ctx));
    ctx.clock.advance(PASSWORD_RESET_TTL_MS);

    await expectAppError(
      useCase.execute({ token, newPassword: faker.internet.password() }),
      IdentityError.PasswordResetExpired,
    );
  });

  it("throws PasswordResetDeleted when the token was invalidated", async () => {
    const { reset, token } = await saveReset(await seedAccount(ctx));
    reset.markAsDeleted(ctx.clock.now());
    await ctx.passwordResets.save(reset);

    await expectAppError(
      useCase.execute({ token, newPassword: faker.internet.password() }),
      IdentityError.PasswordResetDeleted,
    );
  });

  it("throws AccountDeleted when the account is deleted", async () => {
    const ana = await seedAccount(ctx);
    const { token } = await saveReset(ana);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute({ token, newPassword: faker.internet.password() }),
      IdentityError.AccountDeleted,
      { accountId: ana.accountId },
    );
  });

  it("creates the password sign-in, with the account's e-mail, for an account that has none", async () => {
    const accountId = faker.database.mongodbObjectId();
    const email = faker.internet.email().toLowerCase();
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
    const { token } = await saveReset({ accountId });
    const newPassword = faker.internet.password();

    await useCase.execute({ token, newPassword });

    const [credential] = await ctx.credentials.listByAccountId(accountId);
    expect(credential?.toSnapshot()).toMatchObject({
      provider: AuthProvider.EMAIL,
      subject: email,
      providerEmail: email,
      passwordHash: await ctx.passwordHasher.hash(newPassword),
    });
  });

  it("throws CredentialDeleted when the credential is deleted", async () => {
    const ana = await seedAccount(ctx);
    const { token } = await saveReset(ana);
    ana.credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(ana.credential);

    await expectAppError(
      useCase.execute({ token, newPassword: faker.internet.password() }),
      IdentityError.CredentialDeleted,
      { credentialId: ana.credential.id.value },
    );
  });

  it("writes nothing when the last write fails", async () => {
    const ana = await seedAccount(ctx);
    const { reset, token } = await saveReset(ana);
    await seedSession(ctx, ana);
    const failure = new Error(faker.lorem.sentence());
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(
      useCase.execute({ token, newPassword: faker.internet.password() }),
    ).rejects.toBe(failure);

    const credential = await ctx.credentials.findById(ana.credential.id.value);
    expect(credential?.passwordHash?.value).toBe(
      ana.credential.passwordHash?.value,
    );
    expect(
      (
        await ctx.passwordResets.findByTokenHash(reset.toSnapshot().tokenHash)
      )?.isConsumed(),
    ).toBe(false);
  });

  it("logs identity.password_reset", async () => {
    const ana = await seedAccount(ctx);
    const { token } = await saveReset(ana);

    await useCase.execute({ token, newPassword: faker.internet.password() });

    expect(ctx.logger.entries).toContainEqual({
      level: LogLevel.INFO,
      event: IdentityUseCaseLogEvent.PasswordReset.name,
      fields: { accountId: ana.accountId },
    });
  });
});
