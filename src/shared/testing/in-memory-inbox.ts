import type { Inbox, InboxEntry } from "../application/ports/inbox";

import type { InMemoryTransactionRunner } from "./in-memory-transaction-runner";

export class InMemoryInbox implements Inbox {
  private readonly snapshots = new Map<string, InboxEntry>();

  constructor(private readonly transactions: InMemoryTransactionRunner) {}

  record(entry: InboxEntry): Promise<boolean> {
    const key = JSON.stringify([entry.consumer, entry.eventId]);
    if (this.snapshots.has(key)) return Promise.resolve(false);

    this.snapshots.set(key, { ...entry });
    this.transactions.onRollback(() => this.snapshots.delete(key));
    return Promise.resolve(true);
  }

  entries(): InboxEntry[] {
    return [...this.snapshots.values()];
  }
}
