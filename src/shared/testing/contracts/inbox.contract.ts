import { faker } from "@faker-js/faker";
import { beforeEach, expect, it } from "vitest";

import type { Inbox, InboxEntry } from "../../application/ports/inbox";
import type { TransactionRunner } from "../../application/ports/transaction-runner";

export type InboxUnderContract = Readonly<{
  inbox: Inbox;
  transactions: TransactionRunner;
  stored(): Promise<InboxEntry[]>;
}>;

const buildEntry = (): InboxEntry => {
  const processedAt = faker.date.recent();
  return {
    consumer: `${faker.lorem.word()}.${faker.string.alpha(12)}`,
    eventId: faker.database.mongodbObjectId(),
    processedAt,
    expiresAt: faker.date.soon({ refDate: processedAt }),
  };
};

export const inboxContract = (create: () => Promise<InboxUnderContract>) => {
  let inbox: Inbox;
  let transactions: TransactionRunner;
  let stored: InboxUnderContract["stored"];

  beforeEach(async () => {
    ({ inbox, transactions, stored } = await create());
  });

  it("records an inbox entry and answers true the first time", async () => {
    const entry = buildEntry();

    expect(await inbox.record(entry)).toBe(true);
    expect(await stored()).toStrictEqual([entry]);
  });

  it("answers false and keeps the first inbox entry when the consumer records the same event again", async () => {
    const entry = buildEntry();
    await inbox.record(entry);

    const again = await inbox.record({
      ...buildEntry(),
      consumer: entry.consumer,
      eventId: entry.eventId,
    });

    expect(again).toBe(false);
    expect(await stored()).toStrictEqual([entry]);
  });

  it("records an inbox entry per consumer and per event id", async () => {
    const entry = buildEntry();
    await inbox.record(entry);

    const otherConsumer = await inbox.record({
      ...entry,
      consumer: `${faker.lorem.word()}.${faker.string.alpha(12)}`,
    });
    const otherEvent = await inbox.record({
      ...entry,
      eventId: faker.database.mongodbObjectId(),
    });

    expect([otherConsumer, otherEvent]).toStrictEqual([true, true]);
    expect(await stored()).toHaveLength(3);
  });

  it("keeps an inbox entry recorded in a transaction that commits", async () => {
    const entry = buildEntry();

    await transactions.run(() => inbox.record(entry));

    expect(await stored()).toStrictEqual([entry]);
  });

  it("drops an inbox entry recorded in a transaction that aborts, so the event records again", async () => {
    const entry = buildEntry();
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await inbox.record(entry);
        throw failure;
      }),
    ).rejects.toBe(failure);
    const stillThere = await stored();

    expect(stillThere).toStrictEqual([]);
    expect(await inbox.record(entry)).toBe(true);
  });
};
