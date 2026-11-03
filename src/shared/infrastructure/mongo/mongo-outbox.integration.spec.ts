import { faker } from "@faker-js/faker";
import { OutboxKind } from "@shared/application/ports/outbox";
import { outboxContract } from "@shared/testing/contracts/outbox.contract";
import { FakeClock } from "@shared/testing/fake-clock";
import type { OutboxEntrySnapshot } from "@shared/testing/in-memory-outbox";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";

import { MongoOutbox } from "./mongo-outbox";
import { MongoTransactionRunner } from "./mongo-transaction-runner";
import type { OutboxDocument } from "./outbox.schema";

const buildEffect = () => ({
  kind: OutboxKind.EFFECT,
  type: `${faker.lorem.word()}.${faker.lorem.word()}_${faker.lorem.word()}`,
  payload: {
    to: faker.internet.email(),
    token: faker.string.alphanumeric(32),
    expiresAt: faker.date.soon(),
  },
});

describe("MongoOutbox", () => {
  const mongo = useMemoryMongo();
  const collection = () =>
    mongo.connection().collection<OutboxDocument>("outbox");

  const stored = async (): Promise<OutboxEntrySnapshot[]> => {
    const documents = await collection()
      .find()
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    return documents.map(
      ({ _id, ...rest }) =>
        ({ id: _id.toHexString(), ...rest }) as OutboxEntrySnapshot,
    );
  };

  const create = async () => {
    const clock = new FakeClock();
    const outbox = new MongoOutbox({ connection: mongo.connection(), clock });
    await outbox.ready();
    await collection().deleteMany({});
    return { outbox, clock };
  };

  outboxContract(async () => ({
    ...(await create()),
    transactions: new MongoTransactionRunner(mongo.connection()),
    stored,
  }));

  describe("on Mongo", () => {
    let outbox: MongoOutbox;
    let clock: FakeClock;

    beforeEach(async () => {
      ({ outbox, clock } = await create());
    });

    it("creates the reservation and the TTL indexes", async () => {
      const indexes = await collection().indexes();

      expect(indexes).toContainEqual(
        expect.objectContaining({
          name: "processedAt_1_failedAt_1_nextAttemptAt_1",
          key: { processedAt: 1, failedAt: 1, nextAttemptAt: 1 },
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

    it("stores a recorded effect with the outbox shape", async () => {
      const effect = buildEffect();
      const at = clock.now();

      await outbox.publish(effect);

      expect(await collection().find().toArray()).toStrictEqual([
        {
          _id: expect.any(Types.ObjectId) as Types.ObjectId,
          kind: OutboxKind.EFFECT,
          type: effect.type,
          payload: effect.payload,
          attempts: 0,
          nextAttemptAt: at,
          lockedUntil: null,
          processedAt: null,
          failedAt: null,
          lastError: null,
          expiresAt: null,
          createdAt: at,
        },
      ]);
    });

    it("stores a published event with the outbox shape and its <module>.<aggregate>.<action> name", async () => {
      const event = {
        kind: OutboxKind.EVENT,
        type: `${faker.lorem.word()}.${faker.lorem.word()}.${faker.lorem.word()}_${faker.lorem.word()}`,
        payload: { accountId: faker.database.mongodbObjectId() },
      };
      const at = clock.now();

      await outbox.publish(event);

      expect(await collection().find().toArray()).toStrictEqual([
        {
          _id: expect.any(Types.ObjectId) as Types.ObjectId,
          kind: OutboxKind.EVENT,
          type: event.type,
          payload: event.payload,
          attempts: 0,
          nextAttemptAt: at,
          lockedUntil: null,
          processedAt: null,
          failedAt: null,
          lastError: null,
          expiresAt: null,
          createdAt: at,
        },
      ]);
    });

    it("refuses every event published together when one type is outside the format", async () => {
      const valid = {
        kind: OutboxKind.EVENT,
        type: `${faker.lorem.word()}.${faker.lorem.word()}.${faker.lorem.word()}`,
        payload: { accountId: faker.database.mongodbObjectId() },
      };

      await expect(
        outbox.publishAll([valid, { ...valid, type: faker.lorem.word() }]),
      ).rejects.toMatchObject({ name: "ValidationError" });

      expect(await collection().countDocuments()).toBe(0);
    });

    it("reserves an entry stored with no kind as an effect", async () => {
      const effect = buildEffect();
      const at = clock.now();
      const _id = new Types.ObjectId();
      await collection().insertOne({
        _id,
        type: effect.type,
        payload: effect.payload,
        attempts: 0,
        nextAttemptAt: at,
        lockedUntil: null,
        processedAt: null,
        failedAt: null,
        lastError: null,
        expiresAt: null,
        createdAt: at,
      });

      const reserved = await outbox.reserve({
        now: at,
        lockedUntil: new Date(at.getTime() + 30_000),
      });

      expect(reserved).toStrictEqual({
        id: _id.toHexString(),
        kind: OutboxKind.EFFECT,
        type: effect.type,
        payload: effect.payload,
        attempts: 0,
      });
    });

    it.each([
      ["no module", faker.lorem.word()],
      [
        "upper case",
        `${faker.lorem.word().toUpperCase()}.${faker.lorem.word()}`,
      ],
      [
        "a space",
        `${faker.lorem.word()}.${faker.lorem.word()} ${faker.lorem.word()}`,
      ],
      ["an empty effect", `${faker.lorem.word()}.`],
      [
        "four parts",
        `${faker.lorem.word()}.${faker.lorem.word()}.${faker.lorem.word()}.${faker.lorem.word()}`,
      ],
    ])(
      "refuses a type outside the <module>.<effect> and <module>.<aggregate>.<action> formats (%s)",
      async (_case, type) => {
        await expect(
          outbox.publish({ ...buildEffect(), type }),
        ).rejects.toMatchObject({ name: "ValidationError" });

        expect(await collection().countDocuments()).toBe(0);
      },
    );

    it("two relays reserving at the same time take an effect once", async () => {
      await outbox.publish(buildEffect());
      const now = clock.now();
      const lockedUntil = new Date(now.getTime() + 30_000);

      const reserved = await Promise.all(
        Array.from({ length: 8 }, () => outbox.reserve({ now, lockedUntil })),
      );

      expect(reserved.filter((effect) => effect !== null)).toHaveLength(1);
    });
  });
});
