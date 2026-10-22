import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";
import { EMAIL_VERIFICATION_TTL_MS } from "../token.policy";

import { VerifyEmailUseCase } from "./verify-email.use-case";

import { EmailVerification } from "@/identity/domain/email-verification.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("VerifyEmailUseCase", () => {
  let ctx: IdentityContext;
  let useCase: VerifyEmailUseCase;

  /** Saves a pending verification for the account; returns it with its plain token. */
  const saveVerification = async (accountId: string) => {
    const token = faker.string.alphanumeric(32);
    const verification = EmailVerification.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId,
        tokenHash: ctx.tokens.hash(token),
        expiresAt: new Date(
          ctx.clock.now().getTime() + EMAIL_VERIFICATION_TTL_MS,
        ),
      },
      ctx.clock.now(),
    );
    await ctx.emailVerifications.save(verification);
    return { verification, token };
  };

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new VerifyEmailUseCase(ctx);
  });

  it("consumes the token and marks the account e-mail as verified", async () => {
    const ana = await seedAccount(ctx);
    const { token } = await saveVerification(ana.accountId);
    const now = ctx.clock.now();

    const output = await useCase.execute({ token });

    expect(output.account).toMatchObject({
      id: ana.accountId,
      email: ana.email,
      emailVerifiedAt: now,
    });

    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.isEmailVerified()).toBe(true);

    const verification = await ctx.emailVerifications.findByTokenHash(
      ctx.tokens.hash(token),
    );
    expect(verification?.consumedAt).toEqual(now);
  });

  it("throws InvalidEmailVerificationToken when the token is unknown", async () => {
    await expectAppError(
      useCase.execute({ token: faker.string.alphanumeric(32) }),
      IdentityError.InvalidEmailVerificationToken,
    );
  });

  it("throws EmailVerificationAlreadyConsumed when the token was already used", async () => {
    const ana = await seedAccount(ctx);
    const { verification, token } = await saveVerification(ana.accountId);
    verification.consume(ctx.clock.now());
    await ctx.emailVerifications.save(verification);

    await expectAppError(
      useCase.execute({ token }),
      IdentityError.EmailVerificationAlreadyConsumed,
    );
  });

  it("throws EmailVerificationExpired once the TTL has passed", async () => {
    const ana = await seedAccount(ctx);
    const { token } = await saveVerification(ana.accountId);
    ctx.clock.advance(EMAIL_VERIFICATION_TTL_MS);

    await expectAppError(
      useCase.execute({ token }),
      IdentityError.EmailVerificationExpired,
    );
  });

  it("throws EmailVerificationDeleted when the token was invalidated", async () => {
    const ana = await seedAccount(ctx);
    const { verification, token } = await saveVerification(ana.accountId);
    verification.markAsDeleted(ctx.clock.now());
    await ctx.emailVerifications.save(verification);

    await expectAppError(
      useCase.execute({ token }),
      IdentityError.EmailVerificationDeleted,
    );
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    const missingId = faker.database.mongodbObjectId();
    const { token } = await saveVerification(missingId);

    await expectAppError(
      useCase.execute({ token }),
      IdentityError.AccountNotFound,
      { accountId: missingId },
    );
  });
});
