import { faker } from "@faker-js/faker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeClock } from "../../testing/fake-clock";
import { FakeLogger } from "../../testing/fake-logger";
import { InMemoryOutbox } from "../../testing/in-memory-outbox";
import { InMemoryTransactionRunner } from "../../testing/in-memory-transaction-runner";
import { SharedLogEvent } from "../logging/shared.log-event";
import { LogLevel } from "../ports/logger";
import type { OutboxQueue } from "../ports/outbox-queue";

import { OutboxRelay } from "./outbox-relay";

const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;
const LOCK_MS = 30_000;

const later = (date: Date, ms: number) => new Date(date.getTime() + ms);

describe("OutboxRelay", () => {
  let clock: FakeClock;
  let outbox: InMemoryOutbox;
  let logger: FakeLogger;
  let enqueue: ReturnType<typeof vi.fn<OutboxQueue["enqueue"]>>;
  let relay: OutboxRelay;

  beforeEach(() => {
    clock = new FakeClock();
    outbox = new InMemoryOutbox({
      transactions: new InMemoryTransactionRunner(),
      clock,
    });
    logger = new FakeLogger();
    enqueue = vi.fn<OutboxQueue["enqueue"]>().mockResolvedValue();
    relay = new OutboxRelay({
      store: outbox,
      queue: { enqueue },
      clock,
      logger,
    });
  });

  afterEach(async () => {
    await relay.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const recordOne = async () => {
    await outbox.record({
      type: `${faker.lorem.word()}.${faker.lorem.word()}`,
      payload: {
        to: faker.internet.email(),
        token: faker.string.alphanumeric(32),
      },
    });
    return outbox.effects().at(-1)!;
  };

  const handedOver = (effect: Awaited<ReturnType<typeof recordOne>>) => ({
    id: effect.id,
    type: effect.type,
    payload: effect.payload,
    attempts: effect.attempts,
  });

  it("hands a due effect to the queue and holds it for 2 hours", async () => {
    const effect = await recordOne();
    const now = clock.now();

    const relayed = await relay.relayNext();

    expect(relayed).toBe(true);
    expect(enqueue.mock.calls).toStrictEqual([[handedOver(effect)]]);
    expect(outbox.effects()).toStrictEqual([
      { ...effect, lockedUntil: later(now, TWO_HOURS_MS) },
    ]);
  });

  it("answers false when nothing is due", async () => {
    expect(await relay.relayNext()).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("locks the effect for 30 s while it hands it over", async () => {
    await recordOne();
    const now = clock.now();
    const seen: (Date | null)[] = [];
    enqueue.mockImplementationOnce(() => {
      seen.push(outbox.effects()[0].lockedUntil);
      return Promise.resolve();
    });

    await relay.relayNext();

    expect(seen).toStrictEqual([later(now, LOCK_MS)]);
  });

  it("hands an effect over again once its 2 hours pass", async () => {
    const effect = await recordOne();
    await relay.relayNext();

    clock.advance(TWO_HOURS_MS - 1);
    const held = await relay.relayNext();
    clock.advance(1);
    const again = await relay.relayNext();

    expect(held).toBe(false);
    expect(again).toBe(true);
    expect(enqueue.mock.calls).toStrictEqual([
      [handedOver(effect)],
      [handedOver(effect)],
    ]);
  });

  describe("running", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });

    it("leaves the effect pending when the queue refuses it", async () => {
      const effect = await recordOne();
      const error = new Error(faker.lorem.sentence());
      enqueue.mockRejectedValueOnce(error);
      const now = clock.now();

      relay.start();
      await vi.advanceTimersByTimeAsync(0);
      const afterRefusal = outbox.effects();
      clock.advance(LOCK_MS);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(logger.entries).toStrictEqual([
        {
          level: LogLevel.ERROR,
          event: SharedLogEvent.OutboxRelayFailed.name,
          fields: { error },
        },
      ]);
      expect(afterRefusal).toStrictEqual([
        { ...effect, lockedUntil: later(now, LOCK_MS) },
      ]);
      expect(enqueue.mock.calls).toStrictEqual([
        [handedOver(effect)],
        [handedOver(effect)],
      ]);
    });

    it("waits 1 000 ms before looking again when nothing is due", async () => {
      const reserve = vi.spyOn(outbox, "reserve");

      relay.start();
      await vi.advanceTimersByTimeAsync(999);
      const beforeTheWait = reserve.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1);

      expect(beforeTheWait).toBe(1);
      expect(reserve).toHaveBeenCalledTimes(2);
    });

    it("looks for the next effect right after handing one over", async () => {
      const reserve = vi.spyOn(outbox, "reserve");
      const first = await recordOne();
      const second = await recordOne();

      relay.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(enqueue.mock.calls).toStrictEqual([
        [handedOver(first)],
        [handedOver(second)],
      ]);
      expect(reserve).toHaveBeenCalledTimes(3);
    });

    it("starts once when asked twice", async () => {
      const reserve = vi.spyOn(outbox, "reserve");

      relay.start();
      relay.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(reserve).toHaveBeenCalledTimes(1);
    });

    it("finishes the hand-over in progress before stop resolves", async () => {
      await recordOne();
      await recordOne();
      const reserve = vi.spyOn(outbox, "reserve");
      let finish = () => {};
      enqueue.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      relay.start();
      await vi.advanceTimersByTimeAsync(0);

      let stopped = false;
      const stopping = relay.stop().then(() => {
        stopped = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      const stoppedBeforeFinish = stopped;
      finish();
      await stopping;

      expect(stoppedBeforeFinish).toBe(false);
      expect(outbox.effects()[0].lockedUntil).toStrictEqual(
        later(clock.now(), TWO_HOURS_MS),
      );
      expect(outbox.effects()[1].lockedUntil).toBeNull();
      expect(reserve).toHaveBeenCalledTimes(1);
    });

    it("stops while idle without waiting for the next look", async () => {
      const reserve = vi.spyOn(outbox, "reserve");
      relay.start();
      await vi.advanceTimersByTimeAsync(0);

      await relay.stop();

      expect(reserve).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("stops without waiting when stopped while looking for an effect", async () => {
      let answer = (_effect: null) => {};
      vi.spyOn(outbox, "reserve").mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      relay.start();

      const stopping = relay.stop();
      answer(null);
      await stopping;

      expect(vi.getTimerCount()).toBe(0);
    });

    it("logs and keeps polling when the store fails", async () => {
      const error = new Error(faker.lorem.sentence());
      const reserve = vi.spyOn(outbox, "reserve").mockRejectedValueOnce(error);

      relay.start();
      await vi.advanceTimersByTimeAsync(999);
      const beforeTheWait = reserve.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1);

      expect(logger.entries).toStrictEqual([
        {
          level: LogLevel.ERROR,
          event: SharedLogEvent.OutboxRelayFailed.name,
          fields: { error },
        },
      ]);
      expect(beforeTheWait).toBe(1);
      expect(reserve).toHaveBeenCalledTimes(2);
    });
  });
});
