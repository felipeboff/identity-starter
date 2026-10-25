import { Clock } from "@shared/application/ports/clock";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { SessionRepository } from "../ports/session.repository";
import { TokenIssuer } from "../ports/token-issuer";
import { SessionIssuer } from "../services/session-issuer";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type RefreshSessionInput = {
  refreshToken: string;
  userAgent: string;
  ipAddress: string;
};

export type RefreshSessionOutput = {
  account: AccountSnapshot;

  accessToken: string;
  refreshToken: string;
};

export type RefreshSessionDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;
  sessions: SessionRepository;

  tokens: TokenIssuer;
  sessionIssuer: SessionIssuer;

  clock: Clock;
};
