import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toOutputAccount } from "../mappers/toOutputAccount";
import { OAuthProfile } from "../ports/oauth-gateway";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { SignInWithOAuthUseCase } from "./sign-in-with-oauth.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipRole } from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("SignInWithOAuthUseCase", () => {
  let ctx: IdentityContext;
  let useCase: SignInWithOAuthUseCase;

  /** Google will answer this code with a random profile; returns both. */
  const givenGoogleLogin = () => {
    const profile: OAuthProfile = {
      subject: faker.string.numeric(21),
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
    };
    const input = {
      provider: AuthProvider.GOOGLE,
      code: faker.string.alphanumeric(20),
      userAgent: faker.internet.userAgent(),
      ipAddress: faker.internet.ip(),
    };
    ctx.oauth.register(AuthProvider.GOOGLE, input.code, profile);
    return { profile, input };
  };

  const saveGoogleCredential = async (
    accountId: string,
    profile: OAuthProfile,
  ) => {
    const credential = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId,
        provider: AuthProvider.GOOGLE,
        subject: profile.subject,
        providerEmail: profile.email,
      },
      ctx.clock.now(),
    );
    await ctx.credentials.save(credential);
    return credential;
  };

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new SignInWithOAuthUseCase(ctx);
  });

  describe("when the provider identity is already linked", () => {
    it("signs in, replaces the current session and marks the account as seen", async () => {
      const { profile, input } = givenGoogleLogin();
      const ana = await seedAccount(ctx, { email: profile.email });
      const google = await saveGoogleCredential(ana.accountId, profile);
      const { session: previous } = await seedSession(ctx, ana);
      ctx.clock.advance(1_000);

      const output = await useCase.execute(input);

      expect(output.isNewAccount).toBe(false);
      expect(output.account).toMatchObject({
        id: ana.accountId,
        lastSeenAt: ctx.clock.now(),
      });

      const replaced = await ctx.sessions.findById(previous.id.value);
      expect(replaced?.revokedReason).toBe(SessionRevocationReason.REPLACED);

      const session = await ctx.sessions.findByTokenHash(
        ctx.tokens.hash(output.refreshToken),
      );
      expect(session?.toSnapshot()).toMatchObject({
        accountId: ana.accountId,
        credentialId: google.id.value,
        membershipId: ana.membership.id.value,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      });
      expect(output.accessToken).toBe(
        `access:${ana.accountId}:${session?.id.value}`,
      );

      const account = await ctx.accounts.findById(ana.accountId);
      expect(account?.lastSeenAt).toEqual(ctx.clock.now());
    });

    it("throws CredentialDeleted when the link was removed", async () => {
      const { profile, input } = givenGoogleLogin();
      const ana = await seedAccount(ctx, { email: profile.email });
      const google = await saveGoogleCredential(ana.accountId, profile);
      google.markAsDeleted(ctx.clock.now());
      await ctx.credentials.save(google);

      await expectAppError(
        useCase.execute(input),
        IdentityError.CredentialDeleted,
        { credentialId: google.id.value },
      );
    });

    it("throws AccountDeleted when the account is deleted", async () => {
      const { profile, input } = givenGoogleLogin();
      const ana = await seedAccount(ctx, { email: profile.email });
      await saveGoogleCredential(ana.accountId, profile);
      ana.account.markAsDeleted(ctx.clock.now());
      await ctx.accounts.save(ana.account);

      await expectAppError(
        useCase.execute(input),
        IdentityError.AccountDeleted,
        { accountId: ana.accountId },
      );
    });

    it("throws MembershipDeleted when the membership is deleted", async () => {
      const { profile, input } = givenGoogleLogin();
      const ana = await seedAccount(ctx, { email: profile.email });
      await saveGoogleCredential(ana.accountId, profile);
      ana.membership.markAsDeleted(ctx.clock.now());
      await ctx.memberships.save(ana.membership);

      await expectAppError(
        useCase.execute(input),
        IdentityError.MembershipDeleted,
        { membershipId: ana.membership.id.value },
      );
    });
  });

  describe("when the provider identity is new", () => {
    it("creates the account, OAuth credential, user membership and session", async () => {
      const { profile, input } = givenGoogleLogin();

      const output = await useCase.execute(input);

      const accountId = output.account.id;
      expect(output.isNewAccount).toBe(true);
      expect(output.account).toMatchObject({
        name: profile.name,
        email: profile.email,
        createdBy: accountId,
        lastSeenAt: null,
      });

      const credential = await ctx.credentials.findByProviderAndSubject(
        AuthProvider.GOOGLE,
        profile.subject,
      );
      expect(credential?.toSnapshot()).toMatchObject({
        accountId,
        providerEmail: profile.email,
        passwordHash: null,
      });

      const membership = await ctx.memberships.findByAccountId(accountId);
      expect(membership?.role).toBe(MembershipRole.USER);

      const session = await ctx.sessions.findByTokenHash(
        ctx.tokens.hash(output.refreshToken),
      );
      expect(session?.toSnapshot()).toMatchObject({
        accountId,
        credentialId: credential?.id.value,
        membershipId: membership?.id.value,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      });
      expect(output.accessToken).toBe(
        `access:${accountId}:${session?.id.value}`,
      );
    });

    it("throws AccountEmailTaken when an account already uses the e-mail", async () => {
      const { profile, input } = givenGoogleLogin();
      await seedAccount(ctx, { email: profile.email });

      await expectAppError(
        useCase.execute(input),
        IdentityError.AccountEmailTaken,
        { email: profile.email },
      );
    });
  });

  it.each(["email", "myspace"])(
    "throws OAuthProviderNotSupported for provider %s",
    async (provider) => {
      const { input } = givenGoogleLogin();

      await expectAppError(
        useCase.execute({ ...input, provider }),
        IdentityError.OAuthProviderNotSupported,
        { provider },
      );
    },
  );

  it("writes nothing when the last write fails", async () => {
    const { profile, input } = givenGoogleLogin();
    const failure = new Error(faker.lorem.sentence());
    const memberships = vi.spyOn(ctx.memberships, "save");
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(useCase.execute(input)).rejects.toBe(failure);

    const [membership] = memberships.mock.calls[0];
    expect(await ctx.memberships.findById(membership.id.value)).toBeNull();
    expect(await ctx.accounts.findByEmail(profile.email)).toBeNull();
    expect(
      await ctx.credentials.findByProviderAndSubject(
        AuthProvider.GOOGLE,
        profile.subject,
      ),
    ).toBeNull();
  });

  it.each([
    ["signing up", () => Promise.resolve()],
    [
      "signing in",
      async (profile: OAuthProfile) => {
        const ana = await seedAccount(ctx, { email: profile.email });
        await saveGoogleCredential(ana.accountId, profile);
      },
    ],
  ])(
    "exchanges the code once, outside the transaction, when %s",
    async (_, given) => {
      const { profile, input } = givenGoogleLogin();
      await given(profile);
      const exchange = ctx.oauth.exchangeCode.bind(ctx.oauth);
      const running: boolean[] = [];
      vi.spyOn(ctx.oauth, "exchangeCode").mockImplementation((...args) => {
        running.push(ctx.transactions.isRunning());
        return exchange(...args);
      });

      await useCase.execute(input);

      expect(running).toStrictEqual([false]);
    },
  );

  it("returns a linked account as it was stored", async () => {
    const { profile, input } = givenGoogleLogin();
    const ana = await seedAccount(ctx, { email: profile.email });
    await saveGoogleCredential(ana.accountId, profile);

    const output = await useCase.execute(input);

    const stored = await ctx.accounts.findById(ana.accountId);
    expect(stored && toOutputAccount(stored)).toStrictEqual(output.account);
  });

  it("returns a new account as it was stored", async () => {
    const { input } = givenGoogleLogin();

    const output = await useCase.execute(input);

    const stored = await ctx.accounts.findById(output.account.id);
    expect(stored && toOutputAccount(stored)).toStrictEqual(output.account);
  });
});
