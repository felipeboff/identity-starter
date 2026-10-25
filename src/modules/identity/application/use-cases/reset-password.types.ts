import { Clock } from "@shared/application/ports/clock";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { CredentialRepository } from "../ports/credential.repository";
import { PasswordHasher } from "../ports/password-hasher";
import { PasswordResetRepository } from "../ports/password-reset.repository";
import { TokenIssuer } from "../ports/token-issuer";
import { AccountResolver } from "../services/account-resolver";
import { SessionRevoker } from "../services/session-revoker";

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export type ResetPasswordDeps = {
  transactions: TransactionRunner;
  credentials: CredentialRepository;
  passwordResets: PasswordResetRepository;

  passwordHasher: PasswordHasher;
  tokens: TokenIssuer;

  clock: Clock;

  accountResolver: AccountResolver;
  sessionRevoker: SessionRevoker;
};
