import { Clock } from "@shared/application/ports/clock";
import type { Logger } from "@shared/application/ports/logger";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountOutput } from "../mappers/toOutputAccount";
import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { PasswordHasher } from "../ports/password-hasher";
import { SessionIssuer } from "../services/session-issuer";
import { SignInThrottle } from "../services/sign-in-throttle";

export type SignInWithEmailInput = {
  email: string;
  password: string;
  userAgent: string;
  ipAddress: string;
};

export type SignInWithEmailOutput = {
  account: AccountOutput;

  accessToken: string;
  refreshToken: string;
};

export type SignInWithEmailDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;

  passwordHasher: PasswordHasher;
  sessionIssuer: SessionIssuer;
  signInThrottle: SignInThrottle;

  clock: Clock;
  logger: Logger;
};
