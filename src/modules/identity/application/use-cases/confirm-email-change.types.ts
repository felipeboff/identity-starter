import { Clock } from "@shared/application/ports/clock";
import type { Logger } from "@shared/application/ports/logger";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { EmailChangeRepository } from "../ports/email-change.repository";
import { IdentityMailer } from "../ports/identity-mailer";
import { TokenIssuer } from "../ports/token-issuer";
import { AccountResolver } from "../services/account-resolver";
import { SessionRevoker } from "../services/session-revoker";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type ConfirmEmailChangeInput = {
  token: string;
};

export type ConfirmEmailChangeOutput = {
  account: AccountSnapshot;
};

export type ConfirmEmailChangeDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  credentials: CredentialRepository;
  emailChanges: EmailChangeRepository;

  tokens: TokenIssuer;
  mailer: IdentityMailer;

  clock: Clock;
  logger: Logger;

  accountResolver: AccountResolver;
  sessionRevoker: SessionRevoker;
};
