import type { Cache } from "@shared/application/ports/cache";
import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { LogContext } from "@shared/application/ports/log-context";
import type { Logger } from "@shared/application/ports/logger";
import type { Outbox } from "@shared/application/ports/outbox";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { CursorPager } from "@shared/application/services/cursor-pager";
import { RateLimiter } from "@shared/application/services/rate-limiter";
import { FailOpenCache } from "@shared/infrastructure/cache/fail-open-cache";
import { FetchHttpClient } from "@shared/infrastructure/http/fetch-http-client";
import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { ObjectIdGenerator } from "@shared/infrastructure/mongo/object-id-generator";
import { RedisCache } from "@shared/infrastructure/redis/redis-cache";
import { HttpRoute } from "@shared/presentation/http/http-route";
import { OutboxConsumer } from "@shared/presentation/outbox/outbox-consumer";
import type { ScheduledJob } from "@shared/presentation/scheduling/scheduled-job";
import type { Redis } from "ioredis";
import type { Connection } from "mongoose";

import { Actor } from "./application/actor";
import { AccessPolicy } from "./application/policies/access.policy";
import { AccessToken } from "./application/ports/access-token";
import { AccountRepository } from "./application/ports/account.repository";
import { CredentialRepository } from "./application/ports/credential.repository";
import { EmailChangeRepository } from "./application/ports/email-change.repository";
import { EmailVerificationRepository } from "./application/ports/email-verification.repository";
import { IdentityMailer } from "./application/ports/identity-mailer";
import { InvitationRepository } from "./application/ports/invitation.repository";
import { MembershipRepository } from "./application/ports/memberships.repository";
import { OAuthGateway } from "./application/ports/oauth-gateway";
import { PasswordHasher } from "./application/ports/password-hasher";
import { PasswordResetRepository } from "./application/ports/password-reset.repository";
import { SessionRepository } from "./application/ports/session.repository";
import { TokenIssuer } from "./application/ports/token-issuer";
import { AccountResolver } from "./application/services/account-resolver";
import { EmailVerificationIssuer } from "./application/services/email-verification-issuer";
import { MembershipResolver } from "./application/services/membership-resolver";
import { SessionIssuer } from "./application/services/session-issuer";
import { SessionRevoker } from "./application/services/session-revoker";
import { SignInThrottle } from "./application/services/sign-in-throttle";
import { AcceptInvitationUseCase } from "./application/use-cases/accept-invitation.use-case";
import { AuthenticateUseCase } from "./application/use-cases/authenticate.use-case";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case";
import { ConfirmEmailChangeUseCase } from "./application/use-cases/confirm-email-change.use-case";
import { DeactivateAccountUseCase } from "./application/use-cases/deactivate-account.use-case";
import { GetMeUseCase } from "./application/use-cases/get-me.use-case";
import { GrantAdminUseCase } from "./application/use-cases/grant-admin.use-case";
import { InviteMemberUseCase } from "./application/use-cases/invite-member.use-case";
import { LinkOAuthUseCase } from "./application/use-cases/link-oauth.use-case";
import { ListAccountSessionsUseCase } from "./application/use-cases/list-account-sessions.use-case";
import { ListCredentialsUseCase } from "./application/use-cases/list-credentials.use-case";
import { ListInvitationsUseCase } from "./application/use-cases/list-invitations.use-case";
import { ListMembersUseCase } from "./application/use-cases/list-members.use-case";
import { ListSessionsUseCase } from "./application/use-cases/list-sessions.use-case";
import { ReactivateAccountUseCase } from "./application/use-cases/reactivate-account.use-case";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.use-case";
import { RequestEmailChangeUseCase } from "./application/use-cases/request-email-change.use-case";
import { RequestEmailVerificationUseCase } from "./application/use-cases/request-email-verification.use-case";
import { RequestPasswordResetUseCase } from "./application/use-cases/request-password-reset.use-case";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case";
import { RevokeAllSessionsUseCase } from "./application/use-cases/revoke-all-sessions.use-case";
import { RevokeInvitationUseCase } from "./application/use-cases/revoke-invitation.use-case";
import { RevokeOtherSessionsUseCase } from "./application/use-cases/revoke-other-sessions.use-case";
import { RevokeSessionUseCase } from "./application/use-cases/revoke-session.use-case";
import { SendEmailVerificationEmailUseCase } from "./application/use-cases/send-email-verification-email.use-case";
import { SendPasswordResetEmailUseCase } from "./application/use-cases/send-password-reset-email.use-case";
import { SignInWithEmailUseCase } from "./application/use-cases/sign-in-with-email.use-case";
import { SignInWithOAuthUseCase } from "./application/use-cases/sign-in-with-oauth.use-case";
import { SignOutUseCase } from "./application/use-cases/sign-out.use-case";
import { SignUpWithEmailUseCase } from "./application/use-cases/sign-up-with-email.use-case";
import { UnlinkOAuthUseCase } from "./application/use-cases/unlink-oauth.use-case";
import { UpdateAccountNameUseCase } from "./application/use-cases/update-account-name.use-case";
import { UpdateMemberPermissionsUseCase } from "./application/use-cases/update-member-permissions.use-case";
import { UpdateMemberRoleUseCase } from "./application/use-cases/update-member-role.use-case";
import { VerifyEmailUseCase } from "./application/use-cases/verify-email.use-case";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher";
import { CryptoTokenIssuer } from "./infrastructure/crypto-token-issuer";
import {
  FetchOAuthGateway,
  type OAuthClientConfig,
} from "./infrastructure/fetch-oauth-gateway";
import { IdentityEmailComposer } from "./infrastructure/identity-email-composer";
import { JoseAccessToken } from "./infrastructure/jose-access-token";
import { LogIdentityMailer } from "./infrastructure/log-identity-mailer";
import {
  type MailSender,
  MailerSendIdentityMailer,
} from "./infrastructure/mailersend-identity-mailer";
import { CachedAccountRepository } from "./infrastructure/persistence/cached-account.repository";
import { CachedMembershipRepository } from "./infrastructure/persistence/cached-membership.repository";
import { IdentityModels } from "./infrastructure/persistence/identity-models";
import { MongoAccountRepository } from "./infrastructure/persistence/mongo-account.repository";
import { MongoCredentialRepository } from "./infrastructure/persistence/mongo-credential.repository";
import { MongoEmailChangeRepository } from "./infrastructure/persistence/mongo-email-change.repository";
import { MongoEmailVerificationRepository } from "./infrastructure/persistence/mongo-email-verification.repository";
import { MongoInvitationRepository } from "./infrastructure/persistence/mongo-invitation.repository";
import { MongoMembershipRepository } from "./infrastructure/persistence/mongo-membership.repository";
import { MongoPasswordResetRepository } from "./infrastructure/persistence/mongo-password-reset.repository";
import { MongoSessionRepository } from "./infrastructure/persistence/mongo-session.repository";
import { AuthenticateMiddleware } from "./presentation/authenticate.middleware";
import { createIdentityOutboxConsumers } from "./presentation/identity.outbox";
import {
  createIdentityPublicRoutes,
  createIdentityRoutes,
} from "./presentation/identity.routes";

const REPOSITORY_CACHE_TTL_MS = 30 * 1000;

export type IdentityModuleDeps = {
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;
  sessions: SessionRepository;
  passwordResets: PasswordResetRepository;
  emailVerifications: EmailVerificationRepository;
  invitations: InvitationRepository;
  emailChanges: EmailChangeRepository;
  transactions: TransactionRunner;
  outbox: Outbox;

  passwordHasher: PasswordHasher;
  tokens: TokenIssuer;
  accessToken: AccessToken;
  mailer: IdentityMailer;
  oauth: OAuthGateway;
  cache: Cache;

  clock: Clock;
  ids: IdGenerator;

  logContext: LogContext;
  logger: Logger;
};

export type IdentityMailerSettings = Readonly<{
  kind: "log" | "mailersend";
  apiKey: string;
  from: MailSender;
}>;

export type IdentitySettings = Readonly<{
  appName: string;
  jwtSecret: string;
  appUrl: URL;
  externalCallTimeoutMs: number;
  mailer: IdentityMailerSettings;
  google: OAuthClientConfig;
  github: OAuthClientConfig;
}>;

export type IdentityRuntime = Readonly<{
  connection: Connection;
  redis: Redis;
  logger: Logger;
  logContext: LogContext;
  outbox: Outbox;
  clock: Clock;
}>;

export type IdentityModule = {
  authenticate: AuthenticateMiddleware;
  publicRoutes: readonly HttpRoute[];
  routes: readonly HttpRoute<Actor>[];
  outboxConsumers: readonly OutboxConsumer[];
  scheduledJobs: readonly ScheduledJob[];
  grantAdmin: GrantAdminUseCase;
};

export const assembleIdentityModule = (
  adapters: IdentityModuleDeps,
): IdentityModule => {
  const rateLimiter = new RateLimiter(adapters);
  const deps = {
    ...adapters,
    rateLimiter,
    sessionIssuer: new SessionIssuer(adapters),
    sessionRevoker: new SessionRevoker(adapters),
    signInThrottle: new SignInThrottle({ rateLimiter }),
    emailVerificationIssuer: new EmailVerificationIssuer(adapters),
    accountResolver: new AccountResolver(adapters),
    membershipResolver: new MembershipResolver(adapters),
    accessPolicy: new AccessPolicy(),
    pager: new CursorPager(),
  };

  const authenticate = new AuthenticateMiddleware({
    authenticate: new AuthenticateUseCase(deps),
    logContext: adapters.logContext,
  });

  const useCases = {
    signUpWithEmail: new SignUpWithEmailUseCase(deps),
    signInWithEmail: new SignInWithEmailUseCase(deps),
    signInWithOAuth: new SignInWithOAuthUseCase(deps),
    refreshSession: new RefreshSessionUseCase(deps),
    requestPasswordReset: new RequestPasswordResetUseCase(deps),
    resetPassword: new ResetPasswordUseCase(deps),
    verifyEmail: new VerifyEmailUseCase(deps),

    signOut: new SignOutUseCase(deps),
    getMe: new GetMeUseCase(deps),
    updateAccountName: new UpdateAccountNameUseCase(deps),
    changePassword: new ChangePasswordUseCase(deps),
    requestEmailVerification: new RequestEmailVerificationUseCase(deps),
    listSessions: new ListSessionsUseCase(deps),
    revokeOtherSessions: new RevokeOtherSessionsUseCase(deps),
    inviteMember: new InviteMemberUseCase(deps),
    listInvitations: new ListInvitationsUseCase(deps),
    revokeInvitation: new RevokeInvitationUseCase(deps),
    acceptInvitation: new AcceptInvitationUseCase(deps),
    requestEmailChange: new RequestEmailChangeUseCase(deps),
    confirmEmailChange: new ConfirmEmailChangeUseCase(deps),
    listCredentials: new ListCredentialsUseCase(deps),
    linkOAuth: new LinkOAuthUseCase(deps),
    unlinkOAuth: new UnlinkOAuthUseCase(deps),
    revokeSession: new RevokeSessionUseCase(deps),
    listAccountSessions: new ListAccountSessionsUseCase(deps),
    revokeAllSessions: new RevokeAllSessionsUseCase(deps),
    deactivateAccount: new DeactivateAccountUseCase(deps),
    reactivateAccount: new ReactivateAccountUseCase(deps),
    listMembers: new ListMembersUseCase(deps),
    updateMemberRole: new UpdateMemberRoleUseCase(deps),
    updateMemberPermissions: new UpdateMemberPermissionsUseCase(deps),
    sendPasswordResetEmail: new SendPasswordResetEmailUseCase(deps),
    sendEmailVerificationEmail: new SendEmailVerificationEmailUseCase(deps),
  };

  return {
    authenticate,
    publicRoutes: createIdentityPublicRoutes({ ...useCases, rateLimiter }),
    routes: createIdentityRoutes({ ...useCases, rateLimiter }),
    outboxConsumers: createIdentityOutboxConsumers(useCases),
    scheduledJobs: [],
    grantAdmin: new GrantAdminUseCase(deps),
  };
};

export const createIdentityModule = async (
  settings: IdentitySettings,
  runtime: IdentityRuntime,
): Promise<IdentityModule> => {
  const models = new IdentityModels(runtime.connection);
  await models.ready();
  const transactions = new MongoTransactionRunner(runtime.connection);
  const http = new FetchHttpClient({
    timeoutMs: settings.externalCallTimeoutMs,
    logger: runtime.logger,
  });
  const composer = new IdentityEmailComposer({
    appUrl: settings.appUrl,
    productName: settings.mailer.from.name,
  });
  const cache = new RedisCache({ client: runtime.redis });
  const repositoryCache = new FailOpenCache({ cache, logger: runtime.logger });

  return assembleIdentityModule({
    accounts: new CachedAccountRepository({
      inner: new MongoAccountRepository(models, transactions),
      cache: repositoryCache,
      transactions,
      ttlMs: REPOSITORY_CACHE_TTL_MS,
    }),
    credentials: new MongoCredentialRepository(models, transactions),
    memberships: new CachedMembershipRepository({
      inner: new MongoMembershipRepository(models, transactions),
      cache: repositoryCache,
      transactions,
      ttlMs: REPOSITORY_CACHE_TTL_MS,
    }),
    sessions: new MongoSessionRepository(models, transactions),
    passwordResets: new MongoPasswordResetRepository(models, transactions),
    emailVerifications: new MongoEmailVerificationRepository(
      models,
      transactions,
    ),
    invitations: new MongoInvitationRepository(models, transactions),
    emailChanges: new MongoEmailChangeRepository(models, transactions),
    transactions,
    outbox: runtime.outbox,

    passwordHasher: new Argon2PasswordHasher(),
    tokens: new CryptoTokenIssuer(),
    accessToken: new JoseAccessToken({
      secret: settings.jwtSecret,
      clock: runtime.clock,
    }),
    mailer:
      settings.mailer.kind === "mailersend"
        ? new MailerSendIdentityMailer({
            apiKey: settings.mailer.apiKey,
            from: settings.mailer.from,
            http,
            composer,
            logger: runtime.logger,
          })
        : new LogIdentityMailer({ composer, logger: runtime.logger }),
    oauth: new FetchOAuthGateway({
      http,
      logger: runtime.logger,
      userAgent: settings.appName,
      google: settings.google,
      github: settings.github,
    }),

    clock: runtime.clock,
    ids: new ObjectIdGenerator(),

    cache,

    logContext: runtime.logContext,
    logger: runtime.logger,
  });
};
