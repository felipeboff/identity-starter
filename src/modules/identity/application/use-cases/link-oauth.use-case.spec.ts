import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import { OAuthProfile } from "../ports/oauth-gateway";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { LinkOAuthUseCase } from "./link-oauth.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("LinkOAuthUseCase", () => {
  let ctx: IdentityContext;
  let useCase: LinkOAuthUseCase;

  /** Google will answer this code with a random profile; returns both. */
  const givenGoogleLogin = () => {
    const profile: OAuthProfile = {
      subject: faker.string.numeric(21),
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
    };
    const code = faker.string.alphanumeric(20);
    ctx.oauth.register(AuthProvider.GOOGLE, code, profile);
    return { profile, code };
  };

  const saveGoogleCredential = async (
    accountId: string,
    subject: string,
    options: { deleted?: boolean } = {},
  ) => {
    const credential = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId,
        provider: AuthProvider.GOOGLE,
        subject,
      },
      ctx.clock.now(),
    );
    if (options.deleted) credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(credential);
    return credential;
  };

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new LinkOAuthUseCase(ctx);
  });

  it("links the provider identity to the account without exposing the password hash", async () => {
    const { profile, code } = givenGoogleLogin();
    const ana = await seedAccount(ctx);

    const output = await useCase.execute(
      { provider: AuthProvider.GOOGLE, code },
      ana.actor,
    );

    expect(output.credential).toMatchObject({
      provider: AuthProvider.GOOGLE,
      providerEmail: profile.email,
    });
    const linked = await ctx.credentials.findById(output.credential.id);
    expect(linked?.toSnapshot()).toMatchObject({
      accountId: ana.accountId,
      subject: profile.subject,
      deletedAt: null,
    });
    expect(output.credential).not.toHaveProperty("passwordHash");

    const stored = await ctx.credentials.findByProviderAndSubject(
      AuthProvider.GOOGLE,
      profile.subject,
    );
    expect(stored?.id.value).toBe(output.credential.id);
  });

  it("returns the existing link when the identity is already linked", async () => {
    const { profile, code } = givenGoogleLogin();
    const ana = await seedAccount(ctx);
    const google = await saveGoogleCredential(ana.accountId, profile.subject);

    const output = await useCase.execute(
      { provider: AuthProvider.GOOGLE, code },
      ana.actor,
    );

    expect(output.credential.id).toBe(google.id.value);
    expect(await ctx.credentials.listByAccountId(ana.accountId)).toHaveLength(
      2,
    );
  });

  it("reactivates the identity when it was unlinked before", async () => {
    const { profile, code } = givenGoogleLogin();
    const ana = await seedAccount(ctx);
    const google = await saveGoogleCredential(ana.accountId, profile.subject, {
      deleted: true,
    });

    const output = await useCase.execute(
      { provider: AuthProvider.GOOGLE, code },
      ana.actor,
    );

    expect(output.credential.id).toBe(google.id.value);
    const stored = await ctx.credentials.findById(google.id.value);
    expect(stored?.isDeleted()).toBe(false);
  });

  it("links a new subject when the previous subject of the provider was unlinked", async () => {
    const { profile, code } = givenGoogleLogin();
    const ana = await seedAccount(ctx);
    const oldSubject = faker.string.numeric(21);
    await saveGoogleCredential(ana.accountId, oldSubject, { deleted: true });

    const output = await useCase.execute(
      { provider: AuthProvider.GOOGLE, code },
      ana.actor,
    );

    const linked = await ctx.credentials.findById(output.credential.id);
    expect(linked?.subject).toBe(profile.subject);
  });

  it("throws OAuthLinkedToAnotherAccount when another account owns the identity", async () => {
    const { profile, code } = givenGoogleLogin();
    const ana = await seedAccount(ctx);
    const bruno = await seedAccount(ctx);
    await saveGoogleCredential(bruno.accountId, profile.subject);

    await expectAppError(
      useCase.execute({ provider: AuthProvider.GOOGLE, code }, ana.actor),
      IdentityError.OAuthLinkedToAnotherAccount,
      { provider: AuthProvider.GOOGLE },
    );
  });

  it("throws OAuthProviderAlreadyLinked when the account has another active subject for the provider", async () => {
    const { code } = givenGoogleLogin();
    const ana = await seedAccount(ctx);
    const otherSubject = faker.string.numeric(21);
    await saveGoogleCredential(ana.accountId, otherSubject);

    await expectAppError(
      useCase.execute({ provider: AuthProvider.GOOGLE, code }, ana.actor),
      IdentityError.OAuthProviderAlreadyLinked,
      { accountId: ana.accountId, provider: AuthProvider.GOOGLE },
    );
  });

  it("throws AccountDeleted when the account is deleted", async () => {
    const { code } = givenGoogleLogin();
    const ana = await seedAccount(ctx);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute({ provider: AuthProvider.GOOGLE, code }, ana.actor),
      IdentityError.AccountDeleted,
      { accountId: ana.accountId },
    );
  });

  it("throws OAuthProviderNotSupported for the email provider", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(
        { provider: AuthProvider.EMAIL, code: faker.string.alphanumeric(20) },
        ana.actor,
      ),
      IdentityError.OAuthProviderNotSupported,
      { provider: AuthProvider.EMAIL },
    );
  });

  it("hands the PKCE code verifier to the provider", async () => {
    const { code } = givenGoogleLogin();
    const ana = await seedAccount(ctx);
    const codeVerifier = faker.string.alphanumeric(64);

    await useCase.execute(
      { provider: AuthProvider.GOOGLE, code, codeVerifier },
      ana.actor,
    );

    expect(ctx.oauth.exchanges).toStrictEqual([
      { provider: AuthProvider.GOOGLE, code, codeVerifier },
    ]);
  });
});
