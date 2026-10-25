import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

export type RepositoryUnderContract<R> = Readonly<{
  repository: R;
  transactions: TransactionRunner;
}>;
