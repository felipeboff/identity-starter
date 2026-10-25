import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { HttpMethod } from "@shared/presentation/http/http-route";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthenticateMiddleware } from "./authenticate.middleware";
import { CallOptions, createIdentityHttp } from "./testing/identity-http";

import { seedAccount } from "@/identity/application/testing/identity-context";
import { ChangePasswordUseCase } from "@/identity/application/use-cases/change-password.use-case";
import { DeactivateAccountUseCase } from "@/identity/application/use-cases/deactivate-account.use-case";
import { GetMeUseCase } from "@/identity/application/use-cases/get-me.use-case";
import { LinkOAuthUseCase } from "@/identity/application/use-cases/link-oauth.use-case";
import { ListSessionsUseCase } from "@/identity/application/use-cases/list-sessions.use-case";
import { ReactivateAccountUseCase } from "@/identity/application/use-cases/reactivate-account.use-case";
import { RefreshSessionUseCase } from "@/identity/application/use-cases/refresh-session.use-case";
import { RequestEmailVerificationUseCase } from "@/identity/application/use-cases/request-email-verification.use-case";
import { RequestPasswordResetUseCase } from "@/identity/application/use-cases/request-password-reset.use-case";
import { ResetPasswordUseCase } from "@/identity/application/use-cases/reset-password.use-case";
import { RevokeAllSessionsUseCase } from "@/identity/application/use-cases/revoke-all-sessions.use-case";
import { RevokeSessionUseCase } from "@/identity/application/use-cases/revoke-session.use-case";
import { SignInWithEmailUseCase } from "@/identity/application/use-cases/sign-in-with-email.use-case";
import { SignInWithOAuthUseCase } from "@/identity/application/use-cases/sign-in-with-oauth.use-case";
import { SignOutUseCase } from "@/identity/application/use-cases/sign-out.use-case";
import { SignUpWithEmailUseCase } from "@/identity/application/use-cases/sign-up-with-email.use-case";
import { UnlinkOAuthUseCase } from "@/identity/application/use-cases/unlink-oauth.use-case";
import { UpdateAccountNameUseCase } from "@/identity/application/use-cases/update-account-name.use-case";
import { UpdateMemberPermissionsUseCase } from "@/identity/application/use-cases/update-member-permissions.use-case";
import { UpdateMemberRoleUseCase } from "@/identity/application/use-cases/update-member-role.use-case";
import { VerifyEmailUseCase } from "@/identity/application/use-cases/verify-email.use-case";
import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipRole } from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

type UseCaseClass = {
  prototype: { execute: (...args: never[]) => Promise<unknown> };
};

const spyOnUseCase = (useCase: UseCaseClass) =>
  vi.spyOn(useCase.prototype, "execute");

const PROBLEM_HEADERS = {
  "content-type": "application/problem+json; charset=utf-8",
};

const PROTECTED_ROUTES: [HttpMethod, string, UseCaseClass][] = [
  ["POST", "/auth/sign-out", SignOutUseCase],
  ["GET", "/me", GetMeUseCase],
  ["PATCH", "/me", UpdateAccountNameUseCase],
  ["PUT", "/me/password", ChangePasswordUseCase],
  ["POST", "/me/email-verification", RequestEmailVerificationUseCase],
  ["GET", "/me/sessions", ListSessionsUseCase],
  ["POST", "/me/oauth/:provider", LinkOAuthUseCase],
  ["DELETE", "/me/oauth/:provider", UnlinkOAuthUseCase],
  ["DELETE", "/sessions/:sessionId", RevokeSessionUseCase],
  ["DELETE", "/accounts/:accountId/sessions", RevokeAllSessionsUseCase],
  ["POST", "/accounts/:accountId/deactivate", DeactivateAccountUseCase],
  ["POST", "/accounts/:accountId/reactivate", ReactivateAccountUseCase],
  ["PUT", "/members/:accountId/role", UpdateMemberRoleUseCase],
  ["PUT", "/members/:accountId/permissions", UpdateMemberPermissionsUseCase],
];

const PUBLIC_ROUTES: [HttpMethod, string][] = [
  ["POST", "/auth/sign-up"],
  ["POST", "/auth/sign-in"],
  ["POST", "/auth/oauth/:provider"],
  ["POST", "/auth/refresh"],
  ["POST", "/auth/password-reset/request"],
  ["POST", "/auth/password-reset"],
  ["POST", "/auth/email-verification"],
];

const anyId = faker.database.mongodbObjectId();
const notAnId = faker.string.alpha(5);
const unknownValue = faker.string.alpha(12);

const INVALID_INPUTS: [HttpMethod, string, UseCaseClass, CallOptions][] = [
  ["POST", "/auth/sign-up", SignUpWithEmailUseCase, { body: {} }],
  ["POST", "/auth/sign-in", SignInWithEmailUseCase, { body: {} }],
  [
    "POST",
    "/auth/oauth/:provider",
    SignInWithOAuthUseCase,
    { params: { provider: AuthProvider.GOOGLE }, body: {} },
  ],
  ["POST", "/auth/refresh", RefreshSessionUseCase, { body: {} }],
  [
    "POST",
    "/auth/password-reset/request",
    RequestPasswordResetUseCase,
    { body: { email: faker.lorem.word() } },
  ],
  ["POST", "/auth/password-reset", ResetPasswordUseCase, { body: {} }],
  ["POST", "/auth/email-verification", VerifyEmailUseCase, { body: {} }],
  ["PATCH", "/me", UpdateAccountNameUseCase, { body: {} }],
  ["PUT", "/me/password", ChangePasswordUseCase, { body: {} }],
  [
    "POST",
    "/me/oauth/:provider",
    LinkOAuthUseCase,
    { params: { provider: AuthProvider.GOOGLE }, body: {} },
  ],
  [
    "DELETE",
    "/sessions/:sessionId",
    RevokeSessionUseCase,
    { params: { sessionId: notAnId } },
  ],
  [
    "DELETE",
    "/accounts/:accountId/sessions",
    RevokeAllSessionsUseCase,
    { params: { accountId: notAnId } },
  ],
  [
    "POST",
    "/accounts/:accountId/deactivate",
    DeactivateAccountUseCase,
    { params: { accountId: notAnId } },
  ],
  [
    "POST",
    "/accounts/:accountId/reactivate",
    ReactivateAccountUseCase,
    { params: { accountId: notAnId } },
  ],
  [
    "PUT",
    "/members/:accountId/role",
    UpdateMemberRoleUseCase,
    { params: { accountId: anyId }, body: { role: unknownValue } },
  ],
  [
    "PUT",
    "/members/:accountId/permissions",
    UpdateMemberPermissionsUseCase,
    { params: { accountId: anyId }, body: { permissions: [unknownValue] } },
  ],
];

describe("identity routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares the 21 routes with authentication only on the protected ones", () => {
    const { routes } = createIdentityHttp();

    expect(
      routes.map((route) => [
        route.method,
        route.path,
        route.middlewares ?? [],
      ]),
    ).toEqual([
      ...PUBLIC_ROUTES.map(([method, path]) => [method, path, []]),
      ...PROTECTED_ROUTES.map(([method, path]) => [
        method,
        path,
        [expect.any(AuthenticateMiddleware)],
      ]),
    ]);
  });

  it("reaches the handler with the token's actor", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();

    const out = await http.call("GET", "/me", { token: ana.token });

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({
      account: { id: ana.accountId },
      membership: { id: ana.membership.id.value },
    });
  });

  it("reads a path id over a body field with the same name", async () => {
    const http = createIdentityHttp();
    const admin = await http.signIn({ role: MembershipRole.ADMIN });
    const bruno = await seedAccount(http.ctx);
    const carla = await seedAccount(http.ctx);

    const out = await http.call("PUT", "/members/:accountId/role", {
      token: admin.token,
      params: { accountId: bruno.accountId },
      body: { accountId: carla.accountId, role: MembershipRole.ADMIN },
    });

    expect(out.body).toMatchObject({
      membership: { accountId: bruno.accountId, role: MembershipRole.ADMIN },
    });
    const carlaMembership = await http.ctx.memberships.findByAccountId(
      carla.accountId,
    );
    expect(carlaMembership?.role).toBe(MembershipRole.USER);
  });

  it("answers 401 invalid_access_token with no data", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    ana.session.revoke(SessionRevocationReason.LOGOUT, http.ctx.clock.now());
    await http.ctx.sessions.save(ana.session);

    const out = await http.call("GET", "/me", { token: ana.token });

    expect(out).toStrictEqual({
      status: 401,
      headers: PROBLEM_HEADERS,
      body: {
        type: `tag:resolve-hub,2026:${IdentityError.InvalidAccessToken.code}`,
        title: "Invalid access token",
        status: 401,
        code: IdentityError.InvalidAccessToken.code,
      },
    });
  });

  it.each(PROTECTED_ROUTES)(
    "answers 401 without a token on %s %s",
    async (method, path, useCase) => {
      const http = createIdentityHttp();
      const execute = spyOnUseCase(useCase);

      const out = await http.call(method, path, {
        params: {
          provider: AuthProvider.GOOGLE,
          sessionId: anyId,
          accountId: anyId,
        },
      });

      expect(out.status).toBe(401);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each(INVALID_INPUTS)(
    "answers 400 before the use case on %s %s",
    async (method, path, useCase, options) => {
      const http = createIdentityHttp();
      const { token } = await http.signIn();
      const execute = spyOnUseCase(useCase);

      const out = await http.call(method, path, { ...options, token });

      expect(out.status).toBe(400);
      expect(out.body).toMatchObject({
        code: SharedError.InputInvalid.code,
        data: {
          violations: expect.arrayContaining([
            expect.objectContaining({ field: expect.any(String) as unknown }),
          ]) as unknown,
        },
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );
});
