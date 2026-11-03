import type { Outbox } from "@shared/application/ports/outbox";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

export type ScheduleEmailChangedNoticeInput = {
  previousEmail: string;
  newEmail: string;
  name: string;
};

export type ScheduleEmailChangedNoticeDeps = {
  transactions: TransactionRunner;
  outbox: Outbox;
};
