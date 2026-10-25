import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { EmailVerificationRepository } from "../ports/email-verification.repository";
import { IdentityMailer } from "../ports/identity-mailer";
import { TokenIssuer } from "../ports/token-issuer";
import { AccountResolver } from "../services/account-resolver";

export type RequestEmailVerificationDeps = {
  transactions: TransactionRunner;
  emailVerifications: EmailVerificationRepository;

  tokens: TokenIssuer;
  mailer: IdentityMailer;

  clock: Clock;
  ids: IdGenerator;

  accountResolver: AccountResolver;
};
