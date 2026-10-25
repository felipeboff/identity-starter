import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { LogContext } from "@shared/application/ports/log-context";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { HttpRoute } from "@shared/presentation/http/http-route";
import type { Connection } from "mongoose";

import { Actor } from "./application/actor";
import { AccessPolicy } from "./application/policies/access.policy";
import { AccessToken } from "./application/ports/access-token";
import { AccountRepository } from "./application/ports/account.repository";
import { CredentialRepository } from "./application/ports/credential.repository";
import { EmailVerificationRepository } from "./application/ports/email-verification.repository";
import { IdentityMailer } from "./application/ports/identity-mailer";
import { MembershipRepository } from "./application/ports/memberships.repository";
import { OAuthGateway } from "./application/ports/oauth-gateway";
import { PasswordHasher } from "./application/ports/password-hasher";
import { PasswordResetRepository } from "./application/ports/password-reset.repository";
import { SessionRepository } from "./application/ports/session.repository";
import { TokenIssuer } from "./application/ports/token-issuer";
import { AccountResolver } from "./application/services/account-resolver";
import { MembershipResolver } from "./application/services/membership-resolver";
import { SessionIssuer } from "./application/services/session-issuer";
import { SessionRevoker } from "./application/services/session-revoker";
import { createIdentityContext } from "./application/testing/identity-context";
import { AuthenticateUseCase } from "./application/use-cases/authenticate.use-case";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case";
import { DeactivateAccountUseCase } from "./application/use-cases/deactivate-account.use-case";
import { GetMeUseCase } from "./application/use-cases/get-me.use-case";
import { LinkOAuthUseCase } from "./application/use-cases/link-oauth.use-case";
import { ListSessionsUseCase } from "./application/use-cases/list-sessions.use-case";
import { ReactivateAccountUseCase } from "./application/use-cases/reactivate-account.use-case";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.use-case";
import { RequestEmailVerificationUseCase } from "./application/use-cases/request-email-verification.use-case";
import { RequestPasswordResetUseCase } from "./application/use-cases/request-password-reset.use-case";
import { ResetPasswordUseCase } from "./application/use-cases/reset-password.use-case";
import { RevokeAllSessionsUseCase } from "./application/use-cases/revoke-all-sessions.use-case";
import { RevokeSessionUseCase } from "./application/use-cases/revoke-session.use-case";
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
import { JoseAccessToken } from "./infrastructure/jose-access-token";
import { IdentityModels } from "./infrastructure/persistence/identity-models";
import { MongoAccountRepository } from "./infrastructure/persistence/mongo-account.repository";
import { MongoCredentialRepository } from "./infrastructure/persistence/mongo-credential.repository";
import { MongoEmailVerificationRepository } from "./infrastructure/persistence/mongo-email-verification.repository";
import { MongoMembershipRepository } from "./infrastructure/persistence/mongo-membership.repository";
import { MongoPasswordResetRepository } from "./infrastructure/persistence/mongo-password-reset.repository";
import { MongoSessionRepository } from "./infrastructure/persistence/mongo-session.repository";
import { AuthenticateMiddleware } from "./presentation/authenticate.middleware";
import {
  createIdentityPublicRoutes,
  createIdentityRoutes,
} from "./presentation/identity.routes";

export type IdentityModuleDeps = {
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;
  sessions: SessionRepository;
  passwordResets: PasswordResetRepository;
  emailVerifications: EmailVerificationRepository;
  transactions: TransactionRunner;

  passwordHasher: PasswordHasher;
  tokens: TokenIssuer;
  accessToken: AccessToken;
  mailer: IdentityMailer;
  oauth: OAuthGateway;

  clock: Clock;
  ids: IdGenerator;

  logContext: LogContext;
};

export type IdentityModule = {
  authenticate: AuthenticateMiddleware;
  publicRoutes: readonly HttpRoute[];
  routes: readonly HttpRoute<Actor>[];
};

export const createIdentityModule = (
  adapters: IdentityModuleDeps,
): IdentityModule => {
  const deps = {
    ...adapters,
    sessionIssuer: new SessionIssuer(adapters),
    sessionRevoker: new SessionRevoker(adapters),
    accountResolver: new AccountResolver(adapters),
    membershipResolver: new MembershipResolver(adapters),
    accessPolicy: new AccessPolicy(),
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
    linkOAuth: new LinkOAuthUseCase(deps),
    unlinkOAuth: new UnlinkOAuthUseCase(deps),
    revokeSession: new RevokeSessionUseCase(deps),
    revokeAllSessions: new RevokeAllSessionsUseCase(deps),
    deactivateAccount: new DeactivateAccountUseCase(deps),
    reactivateAccount: new ReactivateAccountUseCase(deps),
    updateMemberRole: new UpdateMemberRoleUseCase(deps),
    updateMemberPermissions: new UpdateMemberPermissionsUseCase(deps),
  };

  return {
    authenticate,
    publicRoutes: createIdentityPublicRoutes(useCases),
    routes: createIdentityRoutes(useCases),
  };
};

export const createMongoIdentityRepositories = async (
  connection: Connection,
): Promise<
  Pick<
    IdentityModuleDeps,
    | "accounts"
    | "credentials"
    | "memberships"
    | "sessions"
    | "passwordResets"
    | "emailVerifications"
    | "transactions"
  >
> => {
  const models = new IdentityModels(connection);
  await models.ready();
  const transactions = new MongoTransactionRunner(connection);
  return {
    accounts: new MongoAccountRepository(models, transactions),
    credentials: new MongoCredentialRepository(models, transactions),
    memberships: new MongoMembershipRepository(models, transactions),
    sessions: new MongoSessionRepository(models, transactions),
    passwordResets: new MongoPasswordResetRepository(models, transactions),
    emailVerifications: new MongoEmailVerificationRepository(
      models,
      transactions,
    ),
    transactions,
  };
};

export type IdentitySecurityConfig = {
  jwtSecret: string;
  clock: Clock;
};

export const createIdentitySecurityAdapters = ({
  jwtSecret,
  clock,
}: IdentitySecurityConfig): Pick<
  IdentityModuleDeps,
  "passwordHasher" | "accessToken"
> => ({
  passwordHasher: new Argon2PasswordHasher(),
  accessToken: new JoseAccessToken({ secret: jwtSecret, clock }),
});

export const createInMemoryIdentityAdapters = (): IdentityModuleDeps => ({
  ...createIdentityContext(),
  tokens: new CryptoTokenIssuer(),
});
