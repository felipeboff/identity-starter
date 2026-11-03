import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { describe, expect, it, vi } from "vitest";

import { IdentityHttp, createIdentityHttp } from "./testing/identity-http";

import { IdentityOutboxEffect } from "@/identity/application/outbox/identity-outbox-effect";
import {
  recordedEmails,
  seedAccount,
  seedSession,
} from "@/identity/application/testing/identity-context";
import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { EmailVerification } from "@/identity/domain/email-verification.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import {
  Membership,
  MembershipRole,
} from "@/identity/domain/membership.entity";
import { PasswordReset } from "@/identity/domain/password-reset.entity";
import { Session } from "@/identity/domain/session.entity";

const anId = () => faker.database.mongodbObjectId();
const aToken = () => faker.string.alphanumeric(32);
const aCode = () => faker.string.alphanumeric(20);

const failure = (out: { status: number; body?: unknown }) => ({
  status: out.status,
  code: (out.body as { code: string }).code,
});

const googleProfile = () => ({
  subject: faker.string.numeric(21),
  email: faker.internet.email().toLowerCase(),
  name: faker.person.fullName(),
});

const googleCredential = (accountId: string, subject: string, at: Date) =>
  Credential.register(
    {
      id: anId(),
      accountId,
      provider: AuthProvider.GOOGLE,
      subject,
      providerEmail: faker.internet.email().toLowerCase(),
    },
    at,
  );

const signInWithGoogleOnly = async (http: IdentityHttp) => {
  const at = http.ctx.clock.now();
  const accountId = anId();
  const account = Account.register(
    {
      id: accountId,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      createdBy: accountId,
    },
    at,
  );
  const credential = googleCredential(accountId, faker.string.numeric(21), at);
  const membership = Membership.register(
    {
      id: anId(),
      accountId,
      createdBy: accountId,
      role: MembershipRole.USER,
      permissions: [],
    },
    at,
  );
  await http.ctx.accounts.save(account);
  await http.ctx.credentials.save(credential);
  await http.ctx.memberships.save(membership);
  const actor = {
    accountId,
    sessionId: "",
    membershipId: membership.id.value,
    role: membership.role,
    permissions: membership.permissions,
  };
  const { session } = await seedSession(http.ctx, {
    actor,
    account,
    credential,
    membership,
  });
  return http.ctx.accessToken.issue({ accountId, sessionId: session.id.value });
};

const rejectOAuthWith = (
  http: IdentityHttp,
  definition:
    | typeof IdentityError.OAuthCodeRejected
    | typeof IdentityError.OAuthEmailNotVerified
    | typeof IdentityError.OAuthProviderFailed,
) =>
  vi
    .spyOn(http.ctx.oauth, "exchangeCode")
    .mockRejectedValue(
      new AppError(definition, { provider: AuthProvider.GOOGLE }),
    );

const failMail = (
  http: IdentityHttp,
  method: "sendPasswordReset" | "sendEmailVerification",
) =>
  vi
    .spyOn(http.ctx.mailer, method)
    .mockRejectedValue(new AppError(IdentityError.EmailDeliveryFailed));

describe("identity route failures", () => {
  describe("POST /auth/sign-in", () => {
    it("answers the same 401 with no data for an unknown e-mail and a wrong password", async () => {
      const http = createIdentityHttp();
      const ana = await seedAccount(http.ctx);

      const unknown = await http.call("POST", "/auth/sign-in", {
        body: {
          email: faker.internet.email().toLowerCase(),
          password: faker.internet.password(),
        },
      });
      const wrong = await http.call("POST", "/auth/sign-in", {
        body: { email: ana.email, password: faker.internet.password() },
      });

      expect(unknown.status).toBe(401);
      expect(unknown.body).toStrictEqual({
        type: `tag:${http.appName},2026:${IdentityError.InvalidCredentials.code}`,
        title: "Invalid credentials",
        status: 401,
        code: IdentityError.InvalidCredentials.code,
      });
      expect(wrong.status).toBe(401);
      expect(wrong.body).toStrictEqual(unknown.body);
    });

    it("answers 404 when the account has no membership", async () => {
      const http = createIdentityHttp();
      const ana = await seedAccount(http.ctx);
      vi.spyOn(http.ctx.memberships, "findByAccountId").mockResolvedValue(null);

      const out = await http.call("POST", "/auth/sign-in", {
        body: { email: ana.email, password: ana.password },
      });

      expect(failure(out)).toStrictEqual({
        status: 404,
        code: IdentityError.MembershipNotFound.code,
      });
    });

    it("answers 409 when the e-mail credential belongs to another account", async () => {
      const http = createIdentityHttp();
      const at = http.ctx.clock.now();
      const owner = await seedAccount(http.ctx);
      const email = faker.internet.email().toLowerCase();
      const password = faker.internet.password();
      await http.ctx.credentials.save(
        Credential.register(
          {
            id: anId(),
            accountId: owner.accountId,
            provider: AuthProvider.EMAIL,
            subject: email,
            providerEmail: email,
            passwordHash: await http.ctx.passwordHasher.hash(password),
          },
          at,
        ),
      );
      const accountId = anId();
      await http.ctx.accounts.save(
        Account.register(
          {
            id: accountId,
            name: faker.person.fullName(),
            email,
            createdBy: accountId,
          },
          at,
        ),
      );

      const out = await http.call("POST", "/auth/sign-in", {
        body: { email, password },
      });

      expect(failure(out)).toStrictEqual({
        status: 409,
        code: IdentityError.CredentialAccountMismatch.code,
      });
    });

    it("answers 401 for a deactivated account with a wrong password and 422 with the right one", async () => {
      const http = createIdentityHttp();
      const ana = await seedAccount(http.ctx);
      ana.account.markAsDeleted(http.ctx.clock.now());
      await http.ctx.accounts.save(ana.account);

      const wrong = await http.call("POST", "/auth/sign-in", {
        body: { email: ana.email, password: faker.internet.password() },
      });
      const right = await http.call("POST", "/auth/sign-in", {
        body: { email: ana.email, password: ana.password },
      });

      expect(failure(wrong)).toStrictEqual({
        status: 401,
        code: IdentityError.InvalidCredentials.code,
      });
      expect(failure(right)).toStrictEqual({
        status: 422,
        code: IdentityError.AccountDeleted.code,
      });
    });
  });

  describe("POST /auth/oauth/:provider", () => {
    it.each([
      [401, IdentityError.OAuthCodeRejected],
      [403, IdentityError.OAuthEmailNotVerified],
      [422, IdentityError.OAuthProviderFailed],
    ] as const)(
      "answers %i when the provider fails with %o",
      async (status, definition) => {
        const http = createIdentityHttp();
        rejectOAuthWith(http, definition);

        const out = await http.call("POST", "/auth/oauth/:provider", {
          params: { provider: AuthProvider.GOOGLE },
          body: { code: aCode() },
        });

        expect(failure(out)).toStrictEqual({ status, code: definition.code });
      },
    );

    it("answers 404 when the linked account no longer exists", async () => {
      const http = createIdentityHttp();
      const profile = googleProfile();
      const code = aCode();
      http.ctx.oauth.register(AuthProvider.GOOGLE, code, profile);
      await http.ctx.credentials.save(
        googleCredential(anId(), profile.subject, http.ctx.clock.now()),
      );

      const out = await http.call("POST", "/auth/oauth/:provider", {
        params: { provider: AuthProvider.GOOGLE },
        body: { code },
      });

      expect(failure(out)).toStrictEqual({
        status: 404,
        code: IdentityError.AccountNotFound.code,
      });
    });
  });

  describe("POST /auth/refresh", () => {
    it("answers 404 when the session's account no longer exists", async () => {
      const http = createIdentityHttp();
      const at = http.ctx.clock.now();
      const refreshToken = aToken();
      await http.ctx.sessions.save(
        Session.register(
          {
            id: anId(),
            accountId: anId(),
            credentialId: anId(),
            membershipId: anId(),
            tokenHash: http.ctx.tokens.hash(refreshToken),
            expiresAt: faker.date.future({ refDate: at }),
            userAgent: faker.internet.userAgent(),
            ipAddress: faker.internet.ip(),
          },
          at,
        ),
      );

      const out = await http.call("POST", "/auth/refresh", {
        body: { refreshToken },
      });

      expect(failure(out)).toStrictEqual({
        status: 404,
        code: IdentityError.AccountNotFound.code,
      });
    });

    it("answers 422 for a session revoked by sign-out", async () => {
      const http = createIdentityHttp();
      const { refreshToken, token } = await http.signIn();
      await http.call("POST", "/auth/sign-out", { token });

      const out = await http.call("POST", "/auth/refresh", {
        body: { refreshToken },
      });

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.SessionRevoked.code,
      });
    });

    it("answers 401 and revokes every session when a rotated token is reused", async () => {
      const http = createIdentityHttp();
      const { refreshToken } = await http.signIn();
      const rotated = await http.call("POST", "/auth/refresh", {
        body: { refreshToken },
      });
      const next = (rotated.body as { refreshToken: string }).refreshToken;

      const reuse = await http.call("POST", "/auth/refresh", {
        body: { refreshToken },
      });
      const afterReuse = await http.call("POST", "/auth/refresh", {
        body: { refreshToken: next },
      });

      expect(failure(reuse)).toStrictEqual({
        status: 401,
        code: IdentityError.RefreshTokenReused.code,
      });
      expect(failure(afterReuse)).toStrictEqual({
        status: 422,
        code: IdentityError.SessionRevoked.code,
      });
    });
  });

  describe("POST /auth/password-reset/request", () => {
    it("answers 204 while the e-mail provider is down", async () => {
      const http = createIdentityHttp();
      const ana = await seedAccount(http.ctx);
      failMail(http, "sendPasswordReset");

      const out = await http.call("POST", "/auth/password-reset/request", {
        body: { email: ana.email },
      });

      expect(out).toStrictEqual({ status: 204 });
      expect(http.ctx.outbox.effects()).toStrictEqual([
        expect.objectContaining({
          type: IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
          payload: expect.objectContaining({ to: ana.email }) as unknown,
          processedAt: null,
          failedAt: null,
        }),
      ]);
    });
  });

  describe("POST /auth/password-reset", () => {
    it("answers 404 when the reset's account no longer exists", async () => {
      const http = createIdentityHttp();
      const at = http.ctx.clock.now();
      const token = aToken();
      await http.ctx.passwordResets.save(
        PasswordReset.register(
          {
            id: anId(),
            accountId: anId(),
            tokenHash: http.ctx.tokens.hash(token),
            expiresAt: faker.date.future({ refDate: at }),
          },
          at,
        ),
      );

      const out = await http.call("POST", "/auth/password-reset", {
        body: { token, newPassword: faker.internet.password() },
      });

      expect(failure(out)).toStrictEqual({
        status: 404,
        code: IdentityError.AccountNotFound.code,
      });
    });

    it("answers 422 for a token already used", async () => {
      const http = createIdentityHttp();
      const ana = await seedAccount(http.ctx);
      await http.call("POST", "/auth/password-reset/request", {
        body: { email: ana.email },
      });
      const [mail] = recordedEmails(
        http.ctx,
        IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
      );
      const reset = () =>
        http.call("POST", "/auth/password-reset", {
          body: { token: mail?.token, newPassword: faker.internet.password() },
        });
      await reset();

      const out = await reset();

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.PasswordResetAlreadyConsumed.code,
      });
    });
  });

  describe("POST /auth/email-verification", () => {
    it("answers 404 when the verification's account no longer exists", async () => {
      const http = createIdentityHttp();
      const at = http.ctx.clock.now();
      const token = aToken();
      await http.ctx.emailVerifications.save(
        EmailVerification.register(
          {
            id: anId(),
            accountId: anId(),
            tokenHash: http.ctx.tokens.hash(token),
            expiresAt: faker.date.future({ refDate: at }),
          },
          at,
        ),
      );

      const out = await http.call("POST", "/auth/email-verification", {
        body: { token },
      });

      expect(failure(out)).toStrictEqual({
        status: 404,
        code: IdentityError.AccountNotFound.code,
      });
    });

    it("answers 422 for a token already used", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      await http.call("POST", "/me/email-verification", { token: ana.token });
      const [mail] = recordedEmails(
        http.ctx,
        IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
      );
      const verify = () =>
        http.call("POST", "/auth/email-verification", {
          body: { token: mail?.token },
        });
      await verify();

      const out = await verify();

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.EmailVerificationAlreadyConsumed.code,
      });
    });
  });

  describe("PUT /me/password", () => {
    it("answers 404 for an account with no e-mail credential", async () => {
      const http = createIdentityHttp();
      const token = await signInWithGoogleOnly(http);

      const out = await http.call("PUT", "/me/password", {
        token,
        body: {
          oldPassword: faker.internet.password(),
          newPassword: faker.internet.password(),
        },
      });

      expect(failure(out)).toStrictEqual({
        status: 404,
        code: IdentityError.CredentialNotFound.code,
      });
    });

    it("answers 422 when the e-mail credential was removed", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      ana.credential.markAsDeleted(http.ctx.clock.now());
      await http.ctx.credentials.save(ana.credential);

      const out = await http.call("PUT", "/me/password", {
        token: ana.token,
        body: {
          oldPassword: ana.password,
          newPassword: faker.internet.password(),
        },
      });

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.CredentialDeleted.code,
      });
    });

    it("answers 401 with no data for a wrong old password", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();

      const out = await http.call("PUT", "/me/password", {
        token: ana.token,
        body: {
          oldPassword: faker.internet.password(),
          newPassword: faker.internet.password(),
        },
      });

      expect(failure(out)).toStrictEqual({
        status: 401,
        code: IdentityError.InvalidCredentials.code,
      });
      expect(out.body).not.toHaveProperty("data");
    });
  });

  describe("POST /me/email-verification", () => {
    it("answers 409 when the e-mail is already verified", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      ana.account.markEmailAsVerified(http.ctx.clock.now());
      await http.ctx.accounts.save(ana.account);

      const out = await http.call("POST", "/me/email-verification", {
        token: ana.token,
      });

      expect(failure(out)).toStrictEqual({
        status: 409,
        code: IdentityError.AccountEmailAlreadyVerified.code,
      });
    });

    it("answers 204 while the e-mail provider is down", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      failMail(http, "sendEmailVerification");

      const out = await http.call("POST", "/me/email-verification", {
        token: ana.token,
      });

      expect(out).toStrictEqual({ status: 204 });
      expect(http.ctx.outbox.effects()).toStrictEqual([
        expect.objectContaining({
          type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
          payload: expect.objectContaining({ to: ana.email }) as unknown,
          processedAt: null,
          failedAt: null,
        }),
      ]);
    });
  });

  describe("POST /me/oauth/:provider", () => {
    it.each([
      [403, IdentityError.OAuthEmailNotVerified],
      [422, IdentityError.OAuthProviderFailed],
    ] as const)(
      "answers %i when the provider fails with %o",
      async (status, definition) => {
        const http = createIdentityHttp();
        const ana = await http.signIn();
        rejectOAuthWith(http, definition);

        const out = await http.call("POST", "/me/oauth/:provider", {
          token: ana.token,
          params: { provider: AuthProvider.GOOGLE },
          body: { code: aCode() },
        });

        expect(failure(out)).toStrictEqual({ status, code: definition.code });
      },
    );

    it("answers 409 when the account already links another identity of the provider", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      const link = () => {
        const code = aCode();
        http.ctx.oauth.register(AuthProvider.GOOGLE, code, googleProfile());
        return http.call("POST", "/me/oauth/:provider", {
          token: ana.token,
          params: { provider: AuthProvider.GOOGLE },
          body: { code },
        });
      };
      await link();

      const out = await link();

      expect(failure(out)).toStrictEqual({
        status: 409,
        code: IdentityError.OAuthProviderAlreadyLinked.code,
      });
    });
  });

  describe("DELETE /me/oauth/:provider", () => {
    it("answers 400 for a provider identity does not support", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();

      const out = await http.call("DELETE", "/me/oauth/:provider", {
        token: ana.token,
        params: { provider: faker.string.alpha(12) },
      });

      expect(failure(out)).toStrictEqual({
        status: 400,
        code: IdentityError.OAuthProviderNotSupported.code,
      });
    });

    it("answers 404 for a provider the account never linked", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();

      const out = await http.call("DELETE", "/me/oauth/:provider", {
        token: ana.token,
        params: { provider: AuthProvider.GOOGLE },
      });

      expect(failure(out)).toStrictEqual({
        status: 404,
        code: IdentityError.CredentialNotFound.code,
      });
    });

    it("answers 422 for the account's last way to sign in", async () => {
      const http = createIdentityHttp();
      const token = await signInWithGoogleOnly(http);

      const out = await http.call("DELETE", "/me/oauth/:provider", {
        token,
        params: { provider: AuthProvider.GOOGLE },
      });

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.LastCredentialCannotBeRemoved.code,
      });
    });
  });

  describe("acting on another account", () => {
    const signInWithout = (http: IdentityHttp, missing: IdentityPermission) =>
      http.signIn({
        role: MembershipRole.ADMIN,
        permissions: Object.values(IdentityPermission).filter(
          (permission) => permission !== missing,
        ),
      });

    const signInAdmin = (http: IdentityHttp) =>
      http.signIn({ permissions: Object.values(IdentityPermission) });

    it.each([
      ["GET", "/accounts/:accountId/sessions", IdentityPermission.SESSION_READ],
      [
        "DELETE",
        "/accounts/:accountId/sessions",
        IdentityPermission.SESSION_REVOKE_ALL,
      ],
      [
        "POST",
        "/accounts/:accountId/deactivate",
        IdentityPermission.ACCOUNT_DEACTIVATE,
      ],
    ] as const)(
      "answers 403 forbidden on someone else's account without the route's permission, even with the admin role, on %s %s",
      async (method, path, missing) => {
        const http = createIdentityHttp();
        const ana = await signInWithout(http, missing);
        const bob = await seedAccount(http.ctx);

        const out = await http.call(method, path, {
          token: ana.token,
          params: { accountId: bob.accountId },
        });

        expect(failure(out)).toStrictEqual({
          status: 403,
          code: IdentityError.Forbidden.code,
        });
      },
    );

    it.each([
      [
        "POST",
        "/accounts/:accountId/reactivate",
        undefined,
        IdentityPermission.ACCOUNT_REACTIVATE,
      ],
      ["GET", "/members", undefined, IdentityPermission.MEMBER_READ],
      [
        "PUT",
        "/members/:accountId/role",
        { role: MembershipRole.ADMIN },
        IdentityPermission.MEMBER_ROLE_UPDATE,
      ],
      [
        "PUT",
        "/members/:accountId/permissions",
        { permissions: [IdentityPermission.INVITATION_READ] },
        IdentityPermission.MEMBER_PERMISSIONS_UPDATE,
      ],
    ] as const)(
      "answers 403 permission_missing without the route's permission, even with the admin role (%s %s)",
      async (method, path, body, missing) => {
        const http = createIdentityHttp();
        const ana = await signInWithout(http, missing);
        const bob = await seedAccount(http.ctx);

        const out = await http.call(method, path, {
          token: ana.token,
          params: { accountId: bob.accountId },
          body,
        });

        expect(out).toMatchObject({
          status: 403,
          body: {
            code: SharedError.PermissionMissing.code,
            data: { required: missing },
          },
        });
      },
    );

    it("answers 403 forbidden to a member granting a permission they do not hold", async () => {
      const http = createIdentityHttp();
      const admin = await http.signIn({
        permissions: [IdentityPermission.MEMBER_PERMISSIONS_UPDATE],
      });
      const bob = await seedAccount(http.ctx);

      const out = await http.call("PUT", "/members/:accountId/permissions", {
        token: admin.token,
        params: { accountId: bob.accountId },
        body: { permissions: [IdentityPermission.SESSION_REVOKE_ALL] },
      });

      expect(failure(out)).toStrictEqual({
        status: 403,
        code: IdentityError.Forbidden.code,
      });
      const membership = await http.ctx.memberships.findByAccountId(
        bob.accountId,
      );
      expect(membership?.permissions).toStrictEqual([]);
    });

    it("answers 403 forbidden to a member changing their own permissions", async () => {
      const http = createIdentityHttp();
      const admin = await signInAdmin(http);

      const out = await http.call("PUT", "/members/:accountId/permissions", {
        token: admin.token,
        params: { accountId: admin.accountId },
        body: { permissions: [] },
      });

      expect(failure(out)).toStrictEqual({
        status: 403,
        code: IdentityError.Forbidden.code,
      });
      const membership = await http.ctx.memberships.findByAccountId(
        admin.accountId,
      );
      expect(membership?.permissions).toStrictEqual(
        Object.values(IdentityPermission),
      );
    });

    it.each([
      ["POST", "/accounts/:accountId/deactivate", undefined, "AccountNotFound"],
      ["POST", "/accounts/:accountId/reactivate", undefined, "AccountNotFound"],
      [
        "PUT",
        "/members/:accountId/role",
        { role: MembershipRole.ADMIN },
        "MembershipNotFound",
      ],
      [
        "PUT",
        "/members/:accountId/permissions",
        { permissions: [IdentityPermission.INVITATION_READ] },
        "MembershipNotFound",
      ],
    ] as const)(
      "answers 404 to an admin on %s %s for an unknown account",
      async (method, path, body, error) => {
        const http = createIdentityHttp();
        const admin = await signInAdmin(http);

        const out = await http.call(method, path, {
          token: admin.token,
          params: { accountId: anId() },
          body,
        });

        expect(failure(out)).toStrictEqual({
          status: 404,
          code: IdentityError[error].code,
        });
      },
    );

    it.each([
      ["PUT", "/members/:accountId/role", { role: MembershipRole.ADMIN }],
      [
        "PUT",
        "/members/:accountId/permissions",
        { permissions: [IdentityPermission.INVITATION_READ] },
      ],
    ] as const)(
      "answers 422 to an admin on %s %s for a removed member",
      async (method, path, body) => {
        const http = createIdentityHttp();
        const admin = await signInAdmin(http);
        const bob = await seedAccount(http.ctx);
        bob.membership.markAsDeleted(http.ctx.clock.now());
        await http.ctx.memberships.save(bob.membership);

        const out = await http.call(method, path, {
          token: admin.token,
          params: { accountId: bob.accountId },
          body,
        });

        expect(failure(out)).toStrictEqual({
          status: 422,
          code: IdentityError.MembershipDeleted.code,
        });
      },
    );
  });

  describe("DELETE /sessions/:sessionId", () => {
    it("answers 403 to a user revoking someone else's session", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      const bob = await http.signIn();

      const out = await http.call("DELETE", "/sessions/:sessionId", {
        token: ana.token,
        params: { sessionId: bob.session.id.value },
      });

      expect(failure(out)).toStrictEqual({
        status: 403,
        code: IdentityError.Forbidden.code,
      });
    });

    it("answers 404 for an unknown session", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();

      const out = await http.call("DELETE", "/sessions/:sessionId", {
        token: ana.token,
        params: { sessionId: anId() },
      });

      expect(failure(out)).toStrictEqual({
        status: 404,
        code: IdentityError.SessionNotFound.code,
      });
    });
  });
});
