import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { Logger } from "@shared/application/ports/logger";
import type { Outbox } from "@shared/application/ports/outbox";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountOutput } from "../mappers/toOutputAccount";
import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { InvitationRepository } from "../ports/invitation.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { PasswordHasher } from "../ports/password-hasher";
import { TokenIssuer } from "../ports/token-issuer";
import { SessionIssuer } from "../services/session-issuer";

export type AcceptInvitationInput = {
  token: string;
  name: string;
  password: string;
  userAgent: string;
  ipAddress: string;
};

export type AcceptInvitationOutput = {
  account: AccountOutput;

  accessToken: string;
  refreshToken: string;
};

export type AcceptInvitationDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;
  invitations: InvitationRepository;
  outbox: Outbox;

  passwordHasher: PasswordHasher;
  tokens: TokenIssuer;
  sessionIssuer: SessionIssuer;

  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
};
