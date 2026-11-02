import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountResolver } from "../services/account-resolver";
import { EmailVerificationIssuer } from "../services/email-verification-issuer";

export type RequestEmailVerificationDeps = {
  transactions: TransactionRunner;

  accountResolver: AccountResolver;
  emailVerificationIssuer: EmailVerificationIssuer;
};
