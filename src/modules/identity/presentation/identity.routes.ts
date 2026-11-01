import type { RateLimiter } from "@shared/application/services/rate-limiter";
import { HttpRoute } from "@shared/presentation/http/http-route";
import { RateLimitMiddleware } from "@shared/presentation/rate-limit.middleware";

import { AcceptInvitationHandler } from "./accept-invitation.handler";
import { ChangePasswordHandler } from "./change-password.handler";
import { ConfirmEmailChangeHandler } from "./confirm-email-change.handler";
import { DeactivateAccountHandler } from "./deactivate-account.handler";
import { GetMeHandler } from "./get-me.handler";
import { InviteMemberHandler } from "./invite-member.handler";
import { LinkOAuthHandler } from "./link-oauth.handler";
import { ListCredentialsHandler } from "./list-credentials.handler";
import { ListInvitationsHandler } from "./list-invitations.handler";
import { ListSessionsHandler } from "./list-sessions.handler";
import { ReactivateAccountHandler } from "./reactivate-account.handler";
import { RefreshSessionHandler } from "./refresh-session.handler";
import { RequestEmailChangeHandler } from "./request-email-change.handler";
import { RequestEmailVerificationHandler } from "./request-email-verification.handler";
import { RequestPasswordResetHandler } from "./request-password-reset.handler";
import { ResetPasswordHandler } from "./reset-password.handler";
import { RevokeAllSessionsHandler } from "./revoke-all-sessions.handler";
import { RevokeInvitationHandler } from "./revoke-invitation.handler";
import { RevokeOtherSessionsHandler } from "./revoke-other-sessions.handler";
import { RevokeSessionHandler } from "./revoke-session.handler";
import { SignInWithEmailHandler } from "./sign-in-with-email.handler";
import { SignInWithOAuthHandler } from "./sign-in-with-oauth.handler";
import { SignOutHandler } from "./sign-out.handler";
import { SignUpWithEmailHandler } from "./sign-up-with-email.handler";
import { UnlinkOAuthHandler } from "./unlink-oauth.handler";
import { UpdateAccountNameHandler } from "./update-account-name.handler";
import { UpdateMemberPermissionsHandler } from "./update-member-permissions.handler";
import { UpdateMemberRoleHandler } from "./update-member-role.handler";
import { VerifyEmailHandler } from "./verify-email.handler";

import { Actor } from "@/identity/application/actor";
import { RateLimitPolicy } from "@/identity/application/rate-limit.policy";
import { AcceptInvitationUseCase } from "@/identity/application/use-cases/accept-invitation.use-case";
import { ChangePasswordUseCase } from "@/identity/application/use-cases/change-password.use-case";
import { ConfirmEmailChangeUseCase } from "@/identity/application/use-cases/confirm-email-change.use-case";
import { DeactivateAccountUseCase } from "@/identity/application/use-cases/deactivate-account.use-case";
import { GetMeUseCase } from "@/identity/application/use-cases/get-me.use-case";
import { InviteMemberUseCase } from "@/identity/application/use-cases/invite-member.use-case";
import { LinkOAuthUseCase } from "@/identity/application/use-cases/link-oauth.use-case";
import { ListCredentialsUseCase } from "@/identity/application/use-cases/list-credentials.use-case";
import { ListInvitationsUseCase } from "@/identity/application/use-cases/list-invitations.use-case";
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

export type IdentityHttpDeps = {
  rateLimiter: RateLimiter;

  signUpWithEmail: SignUpWithEmailUseCase;
  signInWithEmail: SignInWithEmailUseCase;
  signInWithOAuth: SignInWithOAuthUseCase;
  refreshSession: RefreshSessionUseCase;
  requestPasswordReset: RequestPasswordResetUseCase;
  resetPassword: ResetPasswordUseCase;
  verifyEmail: VerifyEmailUseCase;

  signOut: SignOutUseCase;
  getMe: GetMeUseCase;
  updateAccountName: UpdateAccountNameUseCase;
  changePassword: ChangePasswordUseCase;
  requestEmailVerification: RequestEmailVerificationUseCase;
  listSessions: ListSessionsUseCase;
  requestEmailChange: RequestEmailChangeUseCase;
  confirmEmailChange: ConfirmEmailChangeUseCase;
  inviteMember: InviteMemberUseCase;
  listInvitations: ListInvitationsUseCase;
  revokeInvitation: RevokeInvitationUseCase;
  acceptInvitation: AcceptInvitationUseCase;
  revokeOtherSessions: RevokeOtherSessionsUseCase;
  listCredentials: ListCredentialsUseCase;
  linkOAuth: LinkOAuthUseCase;
  unlinkOAuth: UnlinkOAuthUseCase;
  revokeSession: RevokeSessionUseCase;
  revokeAllSessions: RevokeAllSessionsUseCase;
  deactivateAccount: DeactivateAccountUseCase;
  reactivateAccount: ReactivateAccountUseCase;
  updateMemberRole: UpdateMemberRoleUseCase;
  updateMemberPermissions: UpdateMemberPermissionsUseCase;
};

export const createIdentityPublicRoutes = (
  deps: IdentityHttpDeps,
): readonly HttpRoute[] => [
  {
    method: "POST",
    path: "/auth/sign-up",
    status: 201,
    failures: [400, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.SIGN_UP_PER_IP,
      }),
    ],
    handler: new SignUpWithEmailHandler(deps),
  },
  {
    method: "POST",
    path: "/auth/sign-in",
    status: 200,
    failures: [400, 401, 404, 409, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.SIGN_IN_PER_IP,
      }),
    ],
    handler: new SignInWithEmailHandler(deps),
  },
  {
    method: "POST",
    path: "/auth/oauth/:provider",
    status: 200,
    failures: [400, 401, 403, 404, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.OAUTH_PER_IP,
      }),
    ],
    handler: new SignInWithOAuthHandler(deps),
  },
  {
    method: "POST",
    path: "/auth/refresh",
    status: 200,
    failures: [400, 401, 404, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.REFRESH_PER_IP,
      }),
    ],
    handler: new RefreshSessionHandler(deps),
  },
  {
    method: "POST",
    path: "/auth/password-reset/request",
    status: 204,
    failures: [400, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.PASSWORD_RESET_REQUEST_PER_IP,
      }),
    ],
    handler: new RequestPasswordResetHandler(deps),
  },
  {
    method: "POST",
    path: "/auth/password-reset",
    status: 204,
    failures: [400, 401, 404, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.PASSWORD_RESET_PER_IP,
      }),
    ],
    handler: new ResetPasswordHandler(deps),
  },
  {
    method: "POST",
    path: "/auth/email-verification",
    status: 200,
    failures: [400, 401, 404, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.EMAIL_VERIFICATION_PER_IP,
      }),
    ],
    handler: new VerifyEmailHandler(deps),
  },
  {
    method: "POST",
    path: "/auth/invitations/accept",
    status: 201,
    failures: [400, 401, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.ACCEPT_INVITATION_PER_IP,
      }),
    ],
    handler: new AcceptInvitationHandler(deps),
  },
  {
    method: "POST",
    path: "/auth/email-change",
    status: 200,
    failures: [400, 401, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.CONFIRM_EMAIL_CHANGE_PER_IP,
      }),
    ],
    handler: new ConfirmEmailChangeHandler(deps),
  },
];

export const createIdentityRoutes = (
  deps: IdentityHttpDeps,
): readonly HttpRoute<Actor>[] => [
  {
    method: "POST",
    path: "/auth/sign-out",
    status: 204,
    failures: [401],
    handler: new SignOutHandler(deps),
  },
  {
    method: "GET",
    path: "/me",
    status: 200,
    failures: [401],
    handler: new GetMeHandler(deps),
  },
  {
    method: "PATCH",
    path: "/me",
    status: 200,
    failures: [400, 401],
    handler: new UpdateAccountNameHandler(deps),
  },
  {
    method: "PUT",
    path: "/me/password",
    status: 204,
    failures: [400, 401, 404, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.CHANGE_PASSWORD_PER_IP,
      }),
    ],
    handler: new ChangePasswordHandler(deps),
  },
  {
    method: "POST",
    path: "/me/email",
    status: 204,
    failures: [400, 401, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.CHANGE_EMAIL_PER_IP,
      }),
    ],
    handler: new RequestEmailChangeHandler(deps),
  },
  {
    method: "POST",
    path: "/me/email-verification",
    status: 204,
    failures: [401, 409, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.EMAIL_VERIFICATION_REQUEST_PER_IP,
      }),
    ],
    handler: new RequestEmailVerificationHandler(deps),
  },
  {
    method: "GET",
    path: "/me/sessions",
    status: 200,
    failures: [401],
    handler: new ListSessionsHandler(deps),
  },
  {
    method: "DELETE",
    path: "/me/sessions",
    status: 200,
    failures: [401],
    handler: new RevokeOtherSessionsHandler(deps),
  },
  {
    method: "GET",
    path: "/me/credentials",
    status: 200,
    failures: [401],
    handler: new ListCredentialsHandler(deps),
  },
  {
    method: "POST",
    path: "/me/oauth/:provider",
    status: 201,
    failures: [400, 401, 403, 409, 422, 429],
    middlewares: [
      new RateLimitMiddleware({
        limiter: deps.rateLimiter,
        rule: RateLimitPolicy.OAUTH_PER_IP,
      }),
    ],
    handler: new LinkOAuthHandler(deps),
  },
  {
    method: "DELETE",
    path: "/me/oauth/:provider",
    status: 204,
    failures: [400, 401, 404, 422],
    handler: new UnlinkOAuthHandler(deps),
  },
  {
    method: "DELETE",
    path: "/sessions/:sessionId",
    status: 204,
    failures: [400, 401, 403, 404],
    handler: new RevokeSessionHandler(deps),
  },
  {
    method: "DELETE",
    path: "/accounts/:accountId/sessions",
    status: 200,
    failures: [400, 401, 403],
    handler: new RevokeAllSessionsHandler(deps),
  },
  {
    method: "POST",
    path: "/accounts/:accountId/deactivate",
    status: 204,
    failures: [400, 401, 403, 404],
    handler: new DeactivateAccountHandler(deps),
  },
  {
    method: "POST",
    path: "/accounts/:accountId/reactivate",
    status: 200,
    failures: [400, 401, 403, 404],
    handler: new ReactivateAccountHandler(deps),
  },
  {
    method: "PUT",
    path: "/members/:accountId/role",
    status: 200,
    failures: [400, 401, 403, 404, 422],
    handler: new UpdateMemberRoleHandler(deps),
  },
  {
    method: "PUT",
    path: "/members/:accountId/permissions",
    status: 200,
    failures: [400, 401, 403, 404, 422],
    handler: new UpdateMemberPermissionsHandler(deps),
  },
  {
    method: "POST",
    path: "/invitations",
    status: 201,
    failures: [400, 401, 403, 422],
    handler: new InviteMemberHandler(deps),
  },
  {
    method: "GET",
    path: "/invitations",
    status: 200,
    failures: [401, 403],
    handler: new ListInvitationsHandler(deps),
  },
  {
    method: "DELETE",
    path: "/invitations/:invitationId",
    status: 204,
    failures: [400, 401, 403, 404, 422],
    handler: new RevokeInvitationHandler(deps),
  },
];
