import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { EmailChangeRepository } from "../ports/email-change.repository";
import { IdentityMailer } from "../ports/identity-mailer";
import { PasswordHasher } from "../ports/password-hasher";
import { TokenIssuer } from "../ports/token-issuer";
import { AccountResolver } from "../services/account-resolver";

export type RequestEmailChangeInput = {
  newEmail: string;
  password: string;
};

export type RequestEmailChangeDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  emailChanges: EmailChangeRepository;

  passwordHasher: PasswordHasher;
  tokens: TokenIssuer;
  mailer: IdentityMailer;

  clock: Clock;
  ids: IdGenerator;

  accountResolver: AccountResolver;
};
