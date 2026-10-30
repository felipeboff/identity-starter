import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { InvitationRepository } from "../ports/invitation.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { PasswordHasher } from "../ports/password-hasher";
import { TokenIssuer } from "../ports/token-issuer";
import { SessionIssuer } from "../services/session-issuer";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type AcceptInvitationInput = {
  token: string;
  name: string;
  password: string;
  userAgent: string;
  ipAddress: string;
};

export type AcceptInvitationOutput = {
  account: AccountSnapshot;

  accessToken: string;
  refreshToken: string;
};

export type AcceptInvitationDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;
  invitations: InvitationRepository;

  passwordHasher: PasswordHasher;
  tokens: TokenIssuer;
  sessionIssuer: SessionIssuer;

  clock: Clock;
  ids: IdGenerator;
};
