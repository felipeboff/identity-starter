import { faker } from "@faker-js/faker";
import { PAGE_MAX_LIMIT } from "@shared/application/pagination.policy";
import { SharedError } from "@shared/domain/errors/shared.error";
import { NO_INPUT } from "@shared/presentation/handler";
import { HttpMethod } from "@shared/presentation/http/http-route";
import { RateLimitMiddleware } from "@shared/presentation/rate-limit.middleware";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthenticateMiddleware } from "./authenticate.middleware";
import { CallOptions, createIdentityHttp } from "./testing/identity-http";

import { seedAccount } from "@/identity/application/testing/identity-context";
import { AcceptInvitationUseCase } from "@/identity/application/use-cases/accept-invitation.use-case";
import { ChangePasswordUseCase } from "@/identity/application/use-cases/change-password.use-case";
import { ConfirmEmailChangeUseCase } from "@/identity/application/use-cases/confirm-email-change.use-case";
import { DeactivateAccountUseCase } from "@/identity/application/use-cases/deactivate-account.use-case";
import { GetMeUseCase } from "@/identity/application/use-cases/get-me.use-case";
import { InviteMemberUseCase } from "@/identity/application/use-cases/invite-member.use-case";
import { LinkOAuthUseCase } from "@/identity/application/use-cases/link-oauth.use-case";
import { ListAccountSessionsUseCase } from "@/identity/application/use-cases/list-account-sessions.use-case";
import { ListCredentialsUseCase } from "@/identity/application/use-cases/list-credentials.use-case";
import { ListInvitationsUseCase } from "@/identity/application/use-cases/list-invitations.use-case";
import { ListMembersUseCase } from "@/identity/application/use-cases/list-members.use-case";
import { ListPermissionsUseCase } from "@/identity/application/use-cases/list-permissions.use-case";
import { ListSessionsUseCase } from "@/identity/application/use-cases/list-sessions.use-case";
import { ReactivateAccountUseCase } from "@/identity/application/use-cases/reactivate-account.use-case";
import { RefreshSessionUseCase } from "@/identity/application/use-cases/refresh-session.use-case";
import { RequestEmailChangeUseCase } from "@/identity/application/use-cases/request-email-change.use-case";
import { RequestEmailVerificationUseCase } from "@/identity/application/use-cases/request-email-verification.use-case";
import { RequestPasswordResetUseCase } from "@/identity/application/use-cases/request-password-reset.use-case";
import { ResetPasswordUseCase } from "@/identity/application/use-cases/reset-password.use-case";
import { RevokeAllSessionsUseCase } from "@/identity/application/use-cases/revoke-all-sessions.use-case";
import { RevokeInvitationUseCase } from "@/identity/application/use-cases/revoke-invitation.use-case";
import { RevokeOtherSessionsUseCase } from "@/identity/application/use-cases/revoke-other-sessions.use-case";
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
import { IdentityPermission } from "@/identity/domain/identity.permission";
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

const RATE_LIMITED = new Set([
  "POST /auth/sign-up",
  "POST /auth/sign-in",
  "POST /auth/oauth/:provider",
  "POST /auth/refresh",
  "POST /auth/password-reset/request",
  "POST /auth/password-reset",
  "POST /auth/email-verification",
  "PUT /me/password",
  "POST /me/email-verification",
  "POST /me/oauth/:provider",
  "POST /auth/invitations/accept",
  "POST /auth/email-change",
  "POST /me/email",
]);

const PROTECTED_ROUTES: [HttpMethod, string, UseCaseClass][] = [
  ["POST", "/auth/sign-out", SignOutUseCase],
  ["GET", "/me", GetMeUseCase],
  ["PATCH", "/me", UpdateAccountNameUseCase],
  ["PUT", "/me/password", ChangePasswordUseCase],
  ["POST", "/me/email", RequestEmailChangeUseCase],
  ["POST", "/me/email-verification", RequestEmailVerificationUseCase],
  ["GET", "/me/sessions", ListSessionsUseCase],
  ["DELETE", "/me/sessions", RevokeOtherSessionsUseCase],
  ["GET", "/me/credentials", ListCredentialsUseCase],
  ["POST", "/me/oauth/:provider", LinkOAuthUseCase],
  ["DELETE", "/me/oauth/:provider", UnlinkOAuthUseCase],
  ["DELETE", "/sessions/:sessionId", RevokeSessionUseCase],
  ["GET", "/accounts/:accountId/sessions", ListAccountSessionsUseCase],
  ["DELETE", "/accounts/:accountId/sessions", RevokeAllSessionsUseCase],
  ["POST", "/accounts/:accountId/deactivate", DeactivateAccountUseCase],
  ["POST", "/accounts/:accountId/reactivate", ReactivateAccountUseCase],
  ["GET", "/members", ListMembersUseCase],
  ["PUT", "/members/:accountId/role", UpdateMemberRoleUseCase],
  ["PUT", "/members/:accountId/permissions", UpdateMemberPermissionsUseCase],
  ["POST", "/invitations", InviteMemberUseCase],
  ["GET", "/invitations", ListInvitationsUseCase],
  ["DELETE", "/invitations/:invitationId", RevokeInvitationUseCase],
  ["GET", "/permissions", ListPermissionsUseCase],
];

const PUBLIC_ROUTES: [HttpMethod, string][] = [
  ["POST", "/auth/sign-up"],
  ["POST", "/auth/sign-in"],
  ["POST", "/auth/oauth/:provider"],
  ["POST", "/auth/refresh"],
  ["POST", "/auth/password-reset/request"],
  ["POST", "/auth/password-reset"],
  ["POST", "/auth/email-verification"],
  ["POST", "/auth/invitations/accept"],
  ["POST", "/auth/email-change"],
];

const OPERATION_NAME = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;

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
    "GET",
    "/accounts/:accountId/sessions",
    ListAccountSessionsUseCase,
    { params: { accountId: notAnId } },
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
    "GET",
    "/members",
    ListMembersUseCase,
    {
      query: {
        limit: String(
          faker.number.int({
            min: PAGE_MAX_LIMIT + 1,
            max: PAGE_MAX_LIMIT * 10,
          }),
        ),
      },
    },
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
  ["POST", "/invitations", InviteMemberUseCase, { body: {} }],
  [
    "DELETE",
    "/invitations/:invitationId",
    RevokeInvitationUseCase,
    { params: { invitationId: notAnId } },
  ],
  ["POST", "/me/email", RequestEmailChangeUseCase, { body: {} }],
  ["POST", "/auth/invitations/accept", AcceptInvitationUseCase, { body: {} }],
  ["POST", "/auth/email-change", ConfirmEmailChangeUseCase, { body: {} }],
];

type Violation = { field: string; reason: string };

const REFUSED_INPUTS: [HttpMethod, string, CallOptions, Violation[]][] = [
  [
    "POST",
    "/auth/sign-up",
    {
      body: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: faker.string.alphanumeric({ length: { min: 1, max: 11 } }),
      },
    },
    [{ field: "password", reason: "minLength" }],
  ],
  [
    "POST",
    "/auth/sign-in",
    { body: {} },
    [
      { field: "email", reason: "required" },
      { field: "password", reason: "required" },
    ],
  ],
  [
    "POST",
    "/auth/password-reset/request",
    { body: { email: faker.lorem.word() } },
    [{ field: "email", reason: "format" }],
  ],
  [
    "PUT",
    "/members/:accountId/role",
    { params: { accountId: anyId }, body: { role: unknownValue } },
    [{ field: "role", reason: "enum" }],
  ],
  [
    "DELETE",
    "/sessions/:sessionId",
    { params: { sessionId: notAnId } },
    [{ field: "sessionId", reason: "pattern" }],
  ],
];

describe("identity routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares the 32 routes with authentication only on the protected ones", () => {
    const { routes } = createIdentityHttp();

    expect(
      routes.map((route) => [
        route.method,
        route.path,
        route.middlewares ?? [],
      ]),
    ).toEqual([
      ...PUBLIC_ROUTES.map(([method, path]) => [
        method,
        path,
        RATE_LIMITED.has(`${method} ${path}`)
          ? [expect.any(RateLimitMiddleware)]
          : [],
      ]),
      ...PROTECTED_ROUTES.map(([method, path]) => [
        method,
        path,
        RATE_LIMITED.has(`${method} ${path}`)
          ? [
              expect.any(AuthenticateMiddleware),
              expect.any(RateLimitMiddleware),
            ]
          : [expect.any(AuthenticateMiddleware)],
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
    const admin = await http.signIn({
      permissions: [IdentityPermission.MEMBER_ROLE_UPDATE],
    });
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
        type: `tag:${http.appName},2026:${IdentityError.InvalidAccessToken.code}`,
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
          invitationId: anyId,
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

  it("answers 401 before reading the input", async () => {
    const http = createIdentityHttp();
    const execute = spyOnUseCase(UpdateAccountNameUseCase);

    const out = await http.call("PATCH", "/me", { body: {} });

    expect(out.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it("names every handler as module.operation, once", () => {
    const { routes } = createIdentityHttp();
    const names = routes.map((route) => route.handler.name);

    expect(names).toHaveLength(32);
    expect(names.filter((name) => !OPERATION_NAME.test(name))).toStrictEqual(
      [],
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("describes every input as a JSON object schema", () => {
    const { routes } = createIdentityHttp();
    const schemas = routes.map((route) => route.handler.input ?? NO_INPUT);

    expect(schemas).toHaveLength(32);
    for (const schema of schemas) {
      const json: unknown = JSON.parse(JSON.stringify(schema));

      expect(json).toEqual(schema);
      expect(json).toMatchObject({ type: "object" });
    }
  });

  it.each(REFUSED_INPUTS)(
    "answers 400 with each field and the JSON Schema keyword that failed on %s %s",
    async (method, path, options, violations) => {
      const http = createIdentityHttp();
      const { token } = await http.signIn();

      const out = await http.call(method, path, { ...options, token });

      expect(out).toStrictEqual({
        status: 400,
        headers: PROBLEM_HEADERS,
        body: {
          type: `tag:${http.appName},2026:${SharedError.InputInvalid.code}`,
          title: "Input invalid",
          status: 400,
          code: SharedError.InputInvalid.code,
          data: { violations },
        },
      });
    },
  );
});
