import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { Logger } from "@shared/application/ports/logger";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { IdentityMailer } from "../ports/identity-mailer";
import { MembershipRepository } from "../ports/memberships.repository";
import { PasswordHasher } from "../ports/password-hasher";
import { EmailVerificationIssuer } from "../services/email-verification-issuer";
import { SessionIssuer } from "../services/session-issuer";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type SignUpWithEmailInput = {
  name: string;
  email: string;
  password: string;
  userAgent: string;
  ipAddress: string;
};

export type SignUpWithEmailOutput = {
  account: AccountSnapshot;

  accessToken: string;
  refreshToken: string;
};

export type SignUpWithEmailDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;

  passwordHasher: PasswordHasher;
  sessionIssuer: SessionIssuer;
  emailVerificationIssuer: EmailVerificationIssuer;
  mailer: IdentityMailer;

  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
};
