import { Clock } from "@shared/application/ports/clock";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { AccessPolicy } from "../policies/access.policy";
import { AccountRepository } from "../ports/account.repository";
import { SessionRevoker } from "../services/session-revoker";

export type DeactivateAccountInput = {
  accountId: string;
};

export type DeactivateAccountDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  clock: Clock;

  accessPolicy: AccessPolicy;
  sessionRevoker: SessionRevoker;
};
