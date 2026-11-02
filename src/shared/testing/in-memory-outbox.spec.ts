import { describe } from "vitest";

import { outboxContract } from "./contracts/outbox.contract";
import { FakeClock } from "./fake-clock";
import { InMemoryOutbox } from "./in-memory-outbox";
import { InMemoryTransactionRunner } from "./in-memory-transaction-runner";

describe("InMemoryOutbox", () => {
  outboxContract(() => {
    const transactions = new InMemoryTransactionRunner();
    const clock = new FakeClock();
    const outbox = new InMemoryOutbox({ transactions, clock });
    return Promise.resolve({
      outbox,
      transactions,
      clock,
      stored: () => Promise.resolve(outbox.effects()),
    });
  });
});
