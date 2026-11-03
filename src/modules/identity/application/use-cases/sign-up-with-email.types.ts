import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { Outbox } from "@shared/application/ports/outbox";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountOutput } from "../mappers/toOutputAccount";
import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { PasswordHasher } from "../ports/password-hasher";
import { EmailVerificationIssuer } from "../services/email-verification-issuer";
import { SessionIssuer } from "../services/session-issuer";

export type SignUpWithEmailInput = {
  name: string;
  email: string;
  password: string;
  userAgent: string;
  ipAddress: string;
};

export type SignUpWithEmailOutput = {
  account: AccountOutput;

  accessToken: string;
  refreshToken: string;
};

export type SignUpWithEmailDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;
  outbox: Outbox;

  passwordHasher: PasswordHasher;
  sessionIssuer: SessionIssuer;
  emailVerificationIssuer: EmailVerificationIssuer;

  clock: Clock;
  ids: IdGenerator;
};
