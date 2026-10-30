import { Clock } from "@shared/application/ports/clock";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { SessionRevoker } from "../services/session-revoker";

export type RevokeOtherSessionsOutput = {
  revokedCount: number;
};

export type RevokeOtherSessionsDeps = {
  transactions: TransactionRunner;
  clock: Clock;

  sessionRevoker: SessionRevoker;
};
