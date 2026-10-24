import { faker } from "@faker-js/faker";
import { FakeLogContext } from "@shared/testing/fake-log-context";

import { Actor } from "../actor";
import { AccessPolicy } from "../policies/access.policy";
import { AccountResolver } from "../services/account-resolver";
import { MembershipResolver } from "../services/membership-resolver";
import { SessionIssuer } from "../services/session-issuer";
import { SessionRevoker } from "../services/session-revoker";
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
  InMemoryEmailVerificationRepository,
  InMemoryMembershipRepository,
  InMemoryPasswordResetRepository,
  InMemorySessionRepository,
} from "./in-memory-identity-repositories";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import {
  Membership,
  MembershipRole,
} from "@/identity/domain/membership.entity";
import { Session } from "@/identity/domain/session.entity";

export type IdentityContext = ReturnType<typeof createIdentityContext>;

/** Every identity dependency, wired with in-memory fakes. Pass it as `deps`. */
export const createIdentityContext = () => {
  const accounts = new InMemoryAccountRepository();
  const credentials = new InMemoryCredentialRepository();
  const memberships = new InMemoryMembershipRepository();
  const sessions = new InMemorySessionRepository();
  const passwordResets = new InMemoryPasswordResetRepository();
  const emailVerifications = new InMemoryEmailVerificationRepository();

  const clock = new FakeClock();
  const ids = new FakeIdGenerator();
  const passwordHasher = new FakePasswordHasher();
  const tokens = new FakeTokenIssuer();
  const accessToken = new FakeAccessToken();
  const mailer = new FakeIdentityMailer();
  const oauth = new FakeOAuthGateway();
  const logContext = new FakeLogContext();

  const sessionIssuer = new SessionIssuer({
    sessions,
    accessToken,
    tokens,
    ids,
  });
  const sessionRevoker = new SessionRevoker({ sessions });
  const accountResolver = new AccountResolver({ accounts });
  const membershipResolver = new MembershipResolver({ memberships });
  const accessPolicy = new AccessPolicy();

  return {
    accounts,
    credentials,
    memberships,
    sessions,
    passwordResets,
    emailVerifications,
    clock,
    ids,
    passwordHasher,
    tokens,
    accessToken,
    mailer,
    oauth,
    logContext,
    sessionIssuer,
    sessionRevoker,
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
      permissions: [],
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
