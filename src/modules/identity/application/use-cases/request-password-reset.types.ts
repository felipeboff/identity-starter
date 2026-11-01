import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import type { RateLimiter } from "@shared/application/services/rate-limiter";

import { AccountRepository } from "../ports/account.repository";
import { IdentityMailer } from "../ports/identity-mailer";
import { PasswordResetRepository } from "../ports/password-reset.repository";
import { TokenIssuer } from "../ports/token-issuer";

export type RequestPasswordResetInput = {
  email: string;
};

export type RequestPasswordResetDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  passwordResets: PasswordResetRepository;

  tokens: TokenIssuer;
  mailer: IdentityMailer;
  rateLimiter: RateLimiter;

  clock: Clock;
  ids: IdGenerator;
};
