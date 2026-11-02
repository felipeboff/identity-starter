import { Clock } from "@shared/application/ports/clock";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountOutput } from "../mappers/toOutputAccount";
import { AccountRepository } from "../ports/account.repository";
import { EmailVerificationRepository } from "../ports/email-verification.repository";
import { TokenIssuer } from "../ports/token-issuer";
import { AccountResolver } from "../services/account-resolver";

export type VerifyEmailInput = {
  token: string;
};

export type VerifyEmailOutput = {
  account: AccountOutput;
};

export type VerifyEmailDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  emailVerifications: EmailVerificationRepository;

  tokens: TokenIssuer;
  clock: Clock;

  accountResolver: AccountResolver;
};
