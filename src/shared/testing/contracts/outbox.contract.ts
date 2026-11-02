import { faker } from "@faker-js/faker";
import { beforeEach, expect, it } from "vitest";

import type { Outbox } from "../../application/ports/outbox";
import type { OutboxStore } from "../../application/ports/outbox-store";
import type { TransactionRunner } from "../../application/ports/transaction-runner";
import type { FakeClock } from "../fake-clock";
import type { OutboxEffectSnapshot } from "../in-memory-outbox";

export type OutboxUnderContract = Readonly<{
  outbox: Outbox & OutboxStore;
  transactions: TransactionRunner;
  clock: FakeClock;
  stored(): Promise<OutboxEffectSnapshot[]>;
}>;

const buildEffect = () => ({
  type: `${faker.lorem.word()}.${faker.lorem.word()}`,
  payload: {
    to: faker.internet.email(),
    token: faker.string.alphanumeric(32),
    expiresAt: faker.date.soon(),
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
    await outbox.record(effect);
    const [snapshot] = await stored();
    return { effect, id: snapshot.id };
  };

  it("stores a recorded effect pending and due at once", async () => {
    const effect = buildEffect();
    const at = clock.now();

    await outbox.record(effect);

    expect(await stored()).toStrictEqual([
      {
        id: expect.any(String) as string,
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
      type: effect.type,
      payload: effect.payload,
      attempts: 0,
    });
    expect((await stored())[0].lockedUntil).toStrictEqual(lockedUntil);
  });

  it("reserves nothing when no effect is recorded", async () => {
    expect(await reserveNow()).toBeNull();
  });

  it("keeps an effect recorded in a transaction that commits", async () => {
    const effect = buildEffect();

    await transactions.run(() => outbox.record(effect));

    expect((await reserveNow())?.payload).toStrictEqual(effect.payload);
  });

  it("drops an effect recorded in a transaction that aborts", async () => {
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await outbox.record(buildEffect());
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

  it("does not reserve an effect before its next attempt, and reserves it once due", async () => {
    const { id } = await recordOne();
    const wait = aWait();
    await outbox.scheduleRetry({
      id,
      attempts: 1,
      lastError: faker.lorem.sentence(),
      nextAttemptAt: later(clock.now(), wait),
    });

    clock.advance(wait - 1);
    const early = await reserveNow();
    clock.advance(1);
    const due = await reserveNow();

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

  it("reserves the effect due first", async () => {
    const { id: first } = await recordOne();
    clock.advance(aWait());
    await outbox.record(buildEffect());
    const second = (await stored())[1];
    await outbox.scheduleRetry({
      id: first,
      attempts: 1,
      lastError: faker.lorem.sentence(),
      nextAttemptAt: later(second.nextAttemptAt, 1),
    });
    clock.advance(1);

    const reserved = await reserveNow();

    expect(reserved?.id).toBe(second.id);
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

  it("schedules a retry, keeping the payload and releasing the lock", async () => {
    const { id } = await recordOne();
    await reserveNow();
    const [before] = await stored();
    const attempts = faker.number.int({ min: 1, max: 7 });
    const lastError = faker.lorem.sentence();
    const nextAttemptAt = later(clock.now(), aWait());

    await outbox.scheduleRetry({ id, attempts, lastError, nextAttemptAt });

    expect(await stored()).toStrictEqual([
      { ...before, attempts, lastError, nextAttemptAt, lockedUntil: null },
    ]);
  });

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
