import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { UnlinkOAuthUseCase } from "./unlink-oauth.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("UnlinkOAuthUseCase", () => {
  let ctx: IdentityContext;
  let useCase: UnlinkOAuthUseCase;

  const saveGoogleCredential = async (accountId: string) => {
    const credential = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId,
        provider: AuthProvider.GOOGLE,
        subject: faker.string.numeric(21),
      },
      ctx.clock.now(),
    );
    await ctx.credentials.save(credential);
    return credential;
  };

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new UnlinkOAuthUseCase(ctx);
  });

  it("deletes the credential and revokes only the sessions opened with it", async () => {
    const ana = await seedAccount(ctx);
    const google = await saveGoogleCredential(ana.accountId);
    const { session: viaGoogle } = await seedSession(ctx, ana, {
      credentialId: google.id.value,
    });
    const { session: viaEmail } = await seedSession(ctx, ana);

    await useCase.execute({ provider: AuthProvider.GOOGLE }, ana.actor);

    const stored = await ctx.credentials.findById(google.id.value);
    expect(stored?.deletedAt).toEqual(ctx.clock.now());

    const revoked = await ctx.sessions.findById(viaGoogle.id.value);
    expect(revoked?.revokedReason).toBe(SessionRevocationReason.SECURITY);
    expect(revoked?.acceptedByAccountId?.value).toBe(ana.accountId);

    const untouched = await ctx.sessions.findById(viaEmail.id.value);
    expect(untouched?.isRevoked()).toBe(false);
  });

  it("throws LastCredentialCannotBeRemoved when it is the only active credential", async () => {
    const ana = await seedAccount(ctx);
    const google = await saveGoogleCredential(ana.accountId);
    ana.credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(ana.credential);

    await expectAppError(
      useCase.execute({ provider: AuthProvider.GOOGLE }, ana.actor),
      IdentityError.LastCredentialCannotBeRemoved,
      { accountId: ana.accountId },
    );

    const stored = await ctx.credentials.findById(google.id.value);
    expect(stored?.isDeleted()).toBe(false);
  });

  it("throws CredentialNotFound when the provider was never linked", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ provider: AuthProvider.GITHUB }, ana.actor),
      IdentityError.CredentialNotFound,
      { accountId: ana.accountId },
    );
  });

  it("throws CredentialNotFound when the provider was already unlinked", async () => {
    const ana = await seedAccount(ctx);
    const google = await saveGoogleCredential(ana.accountId);
    google.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(google);

    await expectAppError(
      useCase.execute({ provider: AuthProvider.GOOGLE }, ana.actor),
      IdentityError.CredentialNotFound,
      { accountId: ana.accountId },
    );
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    // An actor whose account is not stored.
    const ghost = {
      ...(await seedAccount(ctx)).actor,
      accountId: faker.database.mongodbObjectId(),
    };

    await expectAppError(
      useCase.execute({ provider: AuthProvider.GOOGLE }, ghost),
      IdentityError.AccountNotFound,
      { accountId: ghost.accountId },
    );
  });

  it("throws OAuthProviderNotSupported for the email provider", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ provider: AuthProvider.EMAIL }, ana.actor),
      IdentityError.OAuthProviderNotSupported,
      { provider: AuthProvider.EMAIL },
    );
  });
});
