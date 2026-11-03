import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { OutboxKind } from "../application/ports/outbox";

import { outboxContract } from "./contracts/outbox.contract";
import { FakeClock } from "./fake-clock";
import { InMemoryOutbox } from "./in-memory-outbox";
import { InMemoryTransactionRunner } from "./in-memory-transaction-runner";

const create = () => {
  const transactions = new InMemoryTransactionRunner();
  const clock = new FakeClock();
  const outbox = new InMemoryOutbox({ transactions, clock });
  return { outbox, transactions, clock };
};

describe("InMemoryOutbox", () => {
  outboxContract(() => {
    const created = create();
    return Promise.resolve({
      ...created,
      stored: () => Promise.resolve(created.outbox.entries()),
    });
  });

  it("lists the effects and the events apart", async () => {
    const { outbox } = create();
    await outbox.publish({
      kind: OutboxKind.EFFECT,
      type: `${faker.lorem.word()}.${faker.lorem.word()}`,
      payload: { to: faker.internet.email() },
    });
    await outbox.publish({
      kind: OutboxKind.EVENT,
      type: `${faker.lorem.word()}.${faker.lorem.word()}.${faker.lorem.word()}`,
      payload: { accountId: faker.database.mongodbObjectId() },
    });

    expect(outbox.effects().map((entry) => entry.kind)).toStrictEqual([
      OutboxKind.EFFECT,
    ]);
    expect(outbox.events().map((entry) => entry.kind)).toStrictEqual([
      OutboxKind.EVENT,
    ]);
  });
});
