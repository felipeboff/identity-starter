import { describe } from "vitest";

import { inboxContract } from "./contracts/inbox.contract";
import { InMemoryInbox } from "./in-memory-inbox";
import { InMemoryTransactionRunner } from "./in-memory-transaction-runner";

describe("InMemoryInbox", () => {
  inboxContract(() => {
    const transactions = new InMemoryTransactionRunner();
    const inbox = new InMemoryInbox(transactions);
    return Promise.resolve({
      inbox,
      transactions,
      stored: () => Promise.resolve(inbox.entries()),
    });
  });
});
