import { faker } from "@faker-js/faker";
import { beforeEach, expect, it } from "vitest";

import { type Outbox, OutboxKind } from "../../application/ports/outbox";
import type { OutboxStore } from "../../application/ports/outbox-store";
import type { TransactionRunner } from "../../application/ports/transaction-runner";
import type { FakeClock } from "../fake-clock";
import type { OutboxEntrySnapshot } from "../in-memory-outbox";

export type OutboxUnderContract = Readonly<{
  outbox: Outbox & OutboxStore;
  transactions: TransactionRunner;
  clock: FakeClock;
  stored(): Promise<OutboxEntrySnapshot[]>;
}>;

const buildEffect = () => ({
  kind: OutboxKind.EFFECT,
  type: `${faker.lorem.word()}.${faker.lorem.word()}`,
  payload: {
    to: faker.internet.email(),
    token: faker.string.alphanumeric(32),
    expiresAt: faker.date.soon(),
  },
});

const buildEvent = () => ({
  kind: OutboxKind.EVENT,
  type: `${faker.lorem.word()}.${faker.lorem.word()}.${faker.lorem.word()}`,
  payload: {
    accountId: faker.database.mongodbObjectId(),
    email: faker.internet.email(),
  },
});

const later = (date: Date, ms: number) => new Date(date.getTime() + ms);

const aWait = () => faker.number.int({ min: 1_000, max: 60_000 });

export const outboxContract = (create: () => Promise<OutboxUnderContract>) => {
  let outbox: OutboxUnderContract["outbox"];
  let transactions: TransactionRunner;
  let clock: FakeClock;
  let stored: OutboxUnderContract["stored"];

  beforeEach(async () => {
    ({ outbox, transactions, clock, stored } = await create());
  });

  const reserveNow = () => {
    const now = clock.now();
    return outbox.reserve({ now, lockedUntil: later(now, aWait()) });
  };

  const recordOne = async () => {
    const effect = buildEffect();
    await outbox.publish(effect);
    const [snapshot] = await stored();
    return { effect, id: snapshot.id };
  };

  it("stores a recorded effect pending and due at once", async () => {
    const effect = buildEffect();
    const at = clock.now();

    await outbox.publish(effect);

    expect(await stored()).toStrictEqual([
      {
        id: expect.any(String) as string,
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

  it("reserves a due effect and locks it until the given time", async () => {
    const { effect, id } = await recordOne();
    const now = clock.now();
    const lockedUntil = later(now, aWait());

    const reserved = await outbox.reserve({ now, lockedUntil });

    expect(reserved).toStrictEqual({
      id,
      kind: OutboxKind.EFFECT,
      type: effect.type,
      payload: effect.payload,
      attempts: 0,
    });
    expect((await stored())[0].lockedUntil).toStrictEqual(lockedUntil);
  });

  it("stores a published event pending and due at once, with its name as type", async () => {
    const event = buildEvent();
    const at = clock.now();

    await outbox.publish(event);

    expect(await stored()).toStrictEqual([
      {
        id: expect.any(String) as string,
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

  it("reserves a due event as an event", async () => {
    const event = buildEvent();
    await outbox.publish(event);
    const [{ id }] = await stored();

    expect(await reserveNow()).toStrictEqual({
      id,
      kind: OutboxKind.EVENT,
      type: event.type,
      payload: event.payload,
      attempts: 0,
    });
  });

  it("keeps an event published in a transaction that commits", async () => {
    const event = buildEvent();

    await transactions.run(() => outbox.publish(event));

    expect((await reserveNow())?.payload).toStrictEqual(event.payload);
  });

  it("stores every message published together, pending and due at once", async () => {
    const messages = [buildEffect(), buildEvent()];
    const at = clock.now();

    await outbox.publishAll(messages);

    expect(await stored()).toStrictEqual(
      messages.map((message) => ({
        id: expect.any(String) as string,
        kind: message.kind,
        type: message.type,
        payload: message.payload,
        attempts: 0,
        nextAttemptAt: at,
        lockedUntil: null,
        processedAt: null,
        failedAt: null,
        lastError: null,
        expiresAt: null,
        createdAt: at,
      })),
    );
  });

  it("publishes nothing for an empty list", async () => {
    await outbox.publishAll([]);

    expect(await stored()).toStrictEqual([]);
  });

  it("drops every message published together in a transaction that aborts", async () => {
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await outbox.publishAll([buildEffect(), buildEvent()]);
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await stored()).toStrictEqual([]);
  });

  it("drops an event published in a transaction that aborts", async () => {
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await outbox.publish(buildEvent());
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await stored()).toStrictEqual([]);
  });

  it("reserves nothing when no effect is recorded", async () => {
    expect(await reserveNow()).toBeNull();
  });

  it("keeps an effect recorded in a transaction that commits", async () => {
    const effect = buildEffect();

    await transactions.run(() => outbox.publish(effect));

    expect((await reserveNow())?.payload).toStrictEqual(effect.payload);
  });

  it("drops an effect recorded in a transaction that aborts", async () => {
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await outbox.publish(buildEffect());
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await stored()).toStrictEqual([]);
    expect(await reserveNow()).toBeNull();
  });

  it("does not reserve a processed effect", async () => {
    const { id } = await recordOne();
    const processedAt = clock.now();
    await outbox.markProcessed({
      id,
      processedAt,
      expiresAt: later(processedAt, aWait()),
    });

    expect(await reserveNow()).toBeNull();
  });

  it("does not reserve a failed effect", async () => {
    const { id } = await recordOne();
    const failedAt = clock.now();
    await outbox.markFailed({
      id,
      attempts: 1,
      lastError: faker.lorem.sentence(),
      failedAt,
      expiresAt: later(failedAt, aWait()),
    });

    expect(await reserveNow()).toBeNull();
  });

  it("does not reserve an effect before it is due, and reserves it once due", async () => {
    const { id } = await recordOne();
    const [{ nextAttemptAt }] = await stored();
    const lockedUntil = later(nextAttemptAt, aWait());

    const early = await outbox.reserve({
      now: later(nextAttemptAt, -1),
      lockedUntil,
    });
    const due = await outbox.reserve({ now: nextAttemptAt, lockedUntil });

    expect(early).toBeNull();
    expect(due?.id).toBe(id);
  });

  it("does not reserve an effect while its lock holds, and reserves it once the lock passed", async () => {
    const { id } = await recordOne();
    const lock = aWait();
    const now = clock.now();
    await outbox.reserve({ now, lockedUntil: later(now, lock) });

    clock.advance(lock - 1);
    const held = await reserveNow();
    clock.advance(1);
    const released = await reserveNow();

    expect(held).toBeNull();
    expect(released?.id).toBe(id);
  });

  it("reserves the effect due first, not the one recorded first", async () => {
    const wait = aWait();
    clock.advance(wait);
    await outbox.publish(buildEffect());
    const [second] = await stored();
    clock.advance(-2 * wait);
    await outbox.publish(buildEffect());
    const first = (await stored()).find((effect) => effect.id !== second.id)!;
    clock.advance(4 * wait);

    const reserved = await reserveNow();

    expect(reserved?.id).toBe(first.id);
  });

  it("marks an effect processed, erasing its payload and its lock", async () => {
    const { id } = await recordOne();
    await reserveNow();
    const [before] = await stored();
    const processedAt = clock.now();
    const expiresAt = later(processedAt, aWait());

    await outbox.markProcessed({ id, processedAt, expiresAt });

    expect(await stored()).toStrictEqual([
      { ...before, payload: null, lockedUntil: null, processedAt, expiresAt },
    ]);
  });

  it("holds a handed-over effect until the given time, keeping its payload", async () => {
    const { id } = await recordOne();
    await reserveNow();
    const [before] = await stored();
    const lockedUntil = later(clock.now(), aWait());

    await outbox.markHandedOver({ id, lockedUntil });

    expect(await stored()).toStrictEqual([{ ...before, lockedUntil }]);
  });

  it.each(["processed", "failed"])(
    "does not hold an effect already %s",
    async (end) => {
      const { id } = await recordOne();
      const at = clock.now();
      const expiresAt = later(at, aWait());
      await (end === "processed"
        ? outbox.markProcessed({ id, processedAt: at, expiresAt })
        : outbox.markFailed({
            id,
            attempts: 1,
            lastError: faker.lorem.sentence(),
            failedAt: at,
            expiresAt,
          }));
      const [before] = await stored();

      await outbox.markHandedOver({ id, lockedUntil: later(at, aWait()) });

      expect(await stored()).toStrictEqual([before]);
    },
  );

  it("marks an effect failed, erasing its payload and its lock", async () => {
    const { id } = await recordOne();
    await reserveNow();
    const [before] = await stored();
    const attempts = faker.number.int({ min: 1, max: 8 });
    const lastError = faker.lorem.sentence();
    const failedAt = clock.now();
    const expiresAt = later(failedAt, aWait());

    await outbox.markFailed({ id, attempts, lastError, failedAt, expiresAt });

    expect(await stored()).toStrictEqual([
      {
        ...before,
        payload: null,
        lockedUntil: null,
        attempts,
        lastError,
        failedAt,
        expiresAt,
      },
    ]);
  });
};
