import { faker } from "@faker-js/faker";
import { RateLimiter } from "@shared/application/services/rate-limiter";
import { FakeLogContext } from "@shared/testing/fake-log-context";
import { FakeLogger } from "@shared/testing/fake-logger";
import { InMemoryCache } from "@shared/testing/in-memory-cache";
import { InMemoryTransactionRunner } from "@shared/testing/in-memory-transaction-runner";

import { Actor } from "../actor";
import { AccessPolicy } from "../policies/access.policy";
import { AccountResolver } from "../services/account-resolver";
import { EmailVerificationIssuer } from "../services/email-verification-issuer";
import { MembershipResolver } from "../services/membership-resolver";
import { SessionIssuer } from "../services/session-issuer";
import { SessionRevoker } from "../services/session-revoker";
import { SignInThrottle } from "../services/sign-in-throttle";
import { REFRESH_TOKEN_TTL_MS } from "../session.policy";

import {
  FakeAccessToken,
  FakeClock,
  FakeIdGenerator,
  FakeIdentityMailer,
  FakeOAuthGateway,
  FakePasswordHasher,
  FakeTokenIssuer,
} from "./fakes";
import {
  InMemoryAccountRepository,
  InMemoryCredentialRepository,
  InMemoryEmailChangeRepository,
  InMemoryEmailVerificationRepository,
  InMemoryInvitationRepository,
  InMemoryMembershipRepository,
  InMemoryPasswordResetRepository,
  InMemorySessionRepository,
} from "./in-memory-identity-repositories";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import {
  Membership,
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";
import { Session } from "@/identity/domain/session.entity";

export type IdentityContext = ReturnType<typeof createIdentityContext>;

/** Every identity dependency, wired with in-memory fakes. Pass it as `deps`. */
export const createIdentityContext = () => {
  const transactions = new InMemoryTransactionRunner();
  const accounts = new InMemoryAccountRepository(transactions);
  const credentials = new InMemoryCredentialRepository(transactions);
  const memberships = new InMemoryMembershipRepository(transactions);
  const sessions = new InMemorySessionRepository(transactions);
  const passwordResets = new InMemoryPasswordResetRepository(transactions);
  const emailVerifications = new InMemoryEmailVerificationRepository(
    transactions,
  );
  const invitations = new InMemoryInvitationRepository(transactions);
  const emailChanges = new InMemoryEmailChangeRepository(transactions);

  const clock = new FakeClock();
  const ids = new FakeIdGenerator();
  const passwordHasher = new FakePasswordHasher();
  const tokens = new FakeTokenIssuer();
  const accessToken = new FakeAccessToken();
  const mailer = new FakeIdentityMailer();
  const oauth = new FakeOAuthGateway();
  const logContext = new FakeLogContext();
  const logger = new FakeLogger();
  const cache = new InMemoryCache(clock);
  const rateLimiter = new RateLimiter({ cache, logger });

  const sessionIssuer = new SessionIssuer({
    sessions,
    accessToken,
    tokens,
    ids,
  });
  const sessionRevoker = new SessionRevoker({ sessions });
  const signInThrottle = new SignInThrottle({ rateLimiter });
  const emailVerificationIssuer = new EmailVerificationIssuer({
    emailVerifications,
    tokens,
    clock,
    ids,
  });
  const accountResolver = new AccountResolver({ accounts });
  const membershipResolver = new MembershipResolver({ memberships });
  const accessPolicy = new AccessPolicy();

  return {
    transactions,
    accounts,
    credentials,
    memberships,
    sessions,
    passwordResets,
    emailVerifications,
    invitations,
    emailChanges,
    clock,
    ids,
    passwordHasher,
    tokens,
    accessToken,
    mailer,
    oauth,
    logContext,
    logger,
    cache,
    rateLimiter,
    sessionIssuer,
    sessionRevoker,
    signInThrottle,
    emailVerificationIssuer,
    accountResolver,
    membershipResolver,
    accessPolicy,
  };
};

export type SeedAccountOptions = {
  name?: string;
  email?: string;
  password?: string;
  role?: MembershipRole;
  permissions?: MembershipPermission[];
};

export type SeededAccount = {
  accountId: string;
  /** How this account shows up as caller; its `sessionId` is not persisted. */
  actor: Actor;
  account: Account;
  credential: Credential;
  membership: Membership;
  email: string;
  password: string;
};

/** Persists what SignUpWithEmail would: account, e-mail credential, membership. */
export const seedAccount = async (
  ctx: IdentityContext,
  options: SeedAccountOptions = {},
): Promise<SeededAccount> => {
  const email = (options.email ?? faker.internet.email()).toLowerCase();
  const password = options.password ?? faker.internet.password();
  const at = ctx.clock.now();
  const accountId = faker.database.mongodbObjectId();

  const account = Account.register(
    {
      id: accountId,
      name: options.name ?? faker.person.fullName(),
      email,
      createdBy: accountId,
    },
    at,
  );
  const credential = Credential.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      provider: AuthProvider.EMAIL,
      subject: email,
      providerEmail: email,
      passwordHash: await ctx.passwordHasher.hash(password),
    },
    at,
  );
  const membership = Membership.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      createdBy: accountId,
      role: options.role ?? MembershipRole.USER,
      permissions: options.permissions ?? [],
    },
    at,
  );

  await ctx.accounts.save(account);
  await ctx.credentials.save(credential);
  await ctx.memberships.save(membership);

  const actor: Actor = {
    accountId,
    sessionId: faker.database.mongodbObjectId(),
    membershipId: membership.id.value,
    role: membership.role,
    permissions: membership.permissions,
  };

  return { accountId, actor, account, credential, membership, email, password };
};

export type SeededSession = {
  session: Session;
  refreshToken: string;
  /** The seeded account as caller, signed in with this session. */
  actor: Actor;
};

/** Persists an active session for the seeded account. */
export const seedSession = async (
  ctx: IdentityContext,
  seeded: Pick<
    SeededAccount,
    "actor" | "account" | "credential" | "membership"
  >,
  options: { credentialId?: string; ttlMs?: number } = {},
): Promise<SeededSession> => {
  const at = ctx.clock.now();
  const { token, tokenHash } = ctx.tokens.issue();

  const session = Session.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId: seeded.account.id.value,
      credentialId: options.credentialId ?? seeded.credential.id.value,
      membershipId: seeded.membership.id.value,
      tokenHash,
      expiresAt: new Date(
        at.getTime() + (options.ttlMs ?? REFRESH_TOKEN_TTL_MS),
      ),
      userAgent: faker.internet.userAgent(),
      ipAddress: faker.internet.ip(),
    },
    at,
  );
  await ctx.sessions.save(session);

  return {
    session,
    refreshToken: token,
    actor: { ...seeded.actor, sessionId: session.id.value },
  };
};
