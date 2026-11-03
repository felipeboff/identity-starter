import type { Outbox } from "@shared/application/ports/outbox";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

export type ScheduleWelcomeEmailInput = {
  email: string;
  name: string;
};

export type ScheduleWelcomeEmailDeps = {
  transactions: TransactionRunner;
  outbox: Outbox;
};
