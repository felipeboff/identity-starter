import { faker } from "@faker-js/faker";
import type { InboxEntry } from "@shared/application/ports/inbox";
import { inboxContract } from "@shared/testing/contracts/inbox.contract";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeEach, describe, expect, it } from "vitest";

import type { InboxDocument } from "./inbox.schema";
import { MongoInbox } from "./mongo-inbox";
import { MongoTransactionRunner } from "./mongo-transaction-runner";

describe("MongoInbox", () => {
  const mongo = useMemoryMongo();
  const collection = () =>
    mongo.connection().collection<InboxDocument>("inbox");

  const stored = async (): Promise<InboxEntry[]> => {
    const documents = await collection().find().sort({ _id: 1 }).toArray();
    return documents.map((document) => ({
      consumer: document.consumer,
      eventId: document.eventId,
      processedAt: document.processedAt,
      expiresAt: document.expiresAt,
    }));
  };

  const create = async () => {
    const inbox = new MongoInbox(mongo.connection());
    await inbox.ready();
    await collection().deleteMany({});
    return inbox;
  };

  inboxContract(async () => ({
    inbox: await create(),
    transactions: new MongoTransactionRunner(mongo.connection()),
    stored,
  }));

  describe("on Mongo", () => {
    let inbox: MongoInbox;

    beforeEach(async () => {
      inbox = await create();
    });

    it("creates the unique consumer and event id index and the TTL index of the inbox", async () => {
      const indexes = await collection().indexes();

      expect(indexes).toContainEqual(
        expect.objectContaining({
          name: "consumer_1_eventId_1",
          key: { consumer: 1, eventId: 1 },
          unique: true,
        }),
      );
      expect(indexes).toContainEqual(
        expect.objectContaining({
          name: "expiresAt_1",
          key: { expiresAt: 1 },
          expireAfterSeconds: 0,
        }),
      );
    });

    it("records an inbox entry once when two transactions record it at the same time", async () => {
      const transactions = new MongoTransactionRunner(mongo.connection());
      const processedAt = faker.date.recent();
      const entry = {
        consumer: `${faker.lorem.word()}.${faker.string.alpha(12)}`,
        eventId: faker.database.mongodbObjectId(),
        processedAt,
        expiresAt: faker.date.soon({ refDate: processedAt }),
      };

      const recorded = await Promise.all(
        Array.from({ length: 4 }, () =>
          transactions.run(() => inbox.record(entry)),
        ),
      );

      expect(recorded.filter(Boolean)).toHaveLength(1);
      expect(await stored()).toStrictEqual([entry]);
    });
  });
});
