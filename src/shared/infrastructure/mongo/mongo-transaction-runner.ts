import { AsyncLocalStorage } from "node:async_hooks";

import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import type { Connection } from "mongoose";

type Attempt = { committed: (() => void)[] };

export class MongoTransactionRunner implements TransactionRunner {
  private readonly attempts = new AsyncLocalStorage<Attempt>();

  constructor(private readonly connection: Connection) {
    connection.base.set("transactionAsyncLocalStorage", true);
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.attempts.getStore()) return work();

    let last: Attempt = { committed: [] };
    const value = await this.connection.transaction(() => {
      last = { committed: [] };
      return this.attempts.run(last, work);
    });
    for (const callback of last.committed) callback();
    return value;
  }

  afterCommit(callback: () => void): void {
    const attempt = this.attempts.getStore();
    if (attempt) attempt.committed.push(callback);
    else callback();
  }

  isRunning(): boolean {
    return this.attempts.getStore() !== undefined;
  }
}
