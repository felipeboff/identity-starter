import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { Logger } from "@shared/application/ports/logger";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { OAuthGateway } from "../ports/oauth-gateway";
import { AccountResolver } from "../services/account-resolver";
import { MembershipResolver } from "../services/membership-resolver";
import { SessionIssuer } from "../services/session-issuer";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type SignInWithOAuthInput = {
  provider: string;
  code: string;
  codeVerifier?: string;
  userAgent: string;
  ipAddress: string;
};

export type SignInWithOAuthOutput = {
  account: AccountSnapshot;
  isNewAccount: boolean;

  accessToken: string;
  refreshToken: string;
};

export type SignInWithOAuthDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;

  oauth: OAuthGateway;
  sessionIssuer: SessionIssuer;

  clock: Clock;
  ids: IdGenerator;
  logger: Logger;

  accountResolver: AccountResolver;
  membershipResolver: MembershipResolver;
};

export type Device = Pick<SignInWithOAuthInput, "userAgent" | "ipAddress">;
