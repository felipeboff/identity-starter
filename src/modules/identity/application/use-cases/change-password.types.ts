import { Clock } from "@shared/application/ports/clock";
import type { Logger } from "@shared/application/ports/logger";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { CredentialRepository } from "../ports/credential.repository";
import { PasswordHasher } from "../ports/password-hasher";
import { AccountResolver } from "../services/account-resolver";
import { SessionRevoker } from "../services/session-revoker";

export type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
};

export type ChangePasswordDeps = {
  transactions: TransactionRunner;
  credentials: CredentialRepository;

  passwordHasher: PasswordHasher;
  clock: Clock;
  logger: Logger;

  accountResolver: AccountResolver;
  sessionRevoker: SessionRevoker;
};
