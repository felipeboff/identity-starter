import { AsyncLocalStorage } from "node:async_hooks";

import type { TransactionRunner } from "../application/ports/transaction-runner";
import { AppError } from "../domain/errors/app-error";
import { SharedError } from "../domain/errors/shared.error";

type Attempt = { committed: (() => void)[]; rollbacks: (() => void)[] };

export class InMemoryTransactionRunner implements TransactionRunner {
  private readonly attempts = new AsyncLocalStorage<Attempt>();

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.attempts.getStore()) {
      throw new AppError(SharedError.NestedTransaction);
    }

    const attempt: Attempt = { committed: [], rollbacks: [] };
    let value: T;
    try {
      value = await this.attempts.run(attempt, work);
    } catch (error) {
      for (const rollback of attempt.rollbacks.reverse()) rollback();
      throw error;
    }
    for (const callback of attempt.committed) callback();
    return value;
  }

  afterCommit(callback: () => void): void {
    const attempt = this.attempts.getStore();
    if (attempt) attempt.committed.push(callback);
    else callback();
  }

  onRollback(callback: () => void): void {
    this.attempts.getStore()?.rollbacks.push(callback);
  }

  isRunning(): boolean {
    return this.attempts.getStore() !== undefined;
  }
}
