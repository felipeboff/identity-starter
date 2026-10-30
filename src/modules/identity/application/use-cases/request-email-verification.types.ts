import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { IdentityMailer } from "../ports/identity-mailer";
import { AccountResolver } from "../services/account-resolver";
import { EmailVerificationIssuer } from "../services/email-verification-issuer";

export type RequestEmailVerificationDeps = {
  transactions: TransactionRunner;
  mailer: IdentityMailer;

  accountResolver: AccountResolver;
  emailVerificationIssuer: EmailVerificationIssuer;
};
