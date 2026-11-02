import { faker } from "@faker-js/faker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../domain/errors/app-error";
import { SharedError } from "../../domain/errors/shared.error";
import { FakeClock } from "../../testing/fake-clock";
import { FakeLogger } from "../../testing/fake-logger";
import { InMemoryOutbox } from "../../testing/in-memory-outbox";
import { InMemoryTransactionRunner } from "../../testing/in-memory-transaction-runner";
import { SharedLogEvent } from "../logging/shared.log-event";
import { LogLevel } from "../ports/logger";
import type { OutboxEffectHandler } from "../ports/outbox";

import { OutboxRelay } from "./outbox-relay";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

const later = (date: Date, ms: number) => new Date(date.getTime() + ms);

describe("OutboxRelay", () => {
  let clock: FakeClock;
  let outbox: InMemoryOutbox;
  let logger: FakeLogger;
  let handle: ReturnType<typeof vi.fn<OutboxEffectHandler["handle"]>>;
  let type: string;
  let relay: OutboxRelay;

  beforeEach(() => {
    clock = new FakeClock();
    outbox = new InMemoryOutbox({
      transactions: new InMemoryTransactionRunner(),
      clock,
    });
    logger = new FakeLogger();
    handle = vi.fn<OutboxEffectHandler["handle"]>().mockResolvedValue();
    type = `${faker.lorem.word()}.${faker.lorem.word()}`;
    relay = new OutboxRelay({
      store: outbox,
      handlers: { [type]: { handle } },
      clock,
      logger,
    });
  });

  afterEach(async () => {
    await relay.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const buildPayload = () => ({
    to: faker.internet.email(),
    token: faker.string.alphanumeric(32),
  });

  const recordOne = async (payload = buildPayload(), effectType = type) => {
    await outbox.record({ type: effectType, payload });
    return outbox.effects().at(-1)!;
  };

  const withAttempts = async (attempts: number) => {
    const effect = await recordOne();
    await outbox.scheduleRetry({
      id: effect.id,
      attempts,
      lastError: faker.lorem.sentence(),
      nextAttemptAt: clock.now(),
    });
    return outbox.effects().at(-1)!;
  };

  it("hands a due effect to the handler of its type and marks it processed", async () => {
    const payload = buildPayload();
    const effect = await recordOne(payload);
    const now = clock.now();

    const relayed = await relay.relayNext();

    expect(relayed).toBe(true);
    expect(handle.mock.calls).toStrictEqual([[payload]]);
    expect(outbox.effects()).toStrictEqual([
      {
        ...effect,
        payload: null,
        lockedUntil: null,
        processedAt: now,
        expiresAt: later(now, SEVEN_DAYS_MS),
      },
    ]);
  });

  it("answers false when nothing is due", async () => {
    expect(await relay.relayNext()).toBe(false);
    expect(handle).not.toHaveBeenCalled();
  });

  it("locks the effect it takes for 30 s", async () => {
    await recordOne();
    const now = clock.now();
    const seen: (Date | null)[] = [];
    handle.mockImplementationOnce(() => {
      seen.push(outbox.effects()[0].lockedUntil);
      return Promise.resolve();
    });

    await relay.relayNext();

    expect(seen).toStrictEqual([later(now, 30_000)]);
  });

  it("schedules a new attempt and logs a warning when the handler fails", async () => {
    const payload = buildPayload();
    const effect = await recordOne(payload);
    const error = new Error(faker.lorem.sentence());
    handle.mockRejectedValueOnce(error);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const now = clock.now();

    const relayed = await relay.relayNext();

    expect(relayed).toBe(true);
    expect(outbox.effects()).toStrictEqual([
      {
        ...effect,
        attempts: 1,
        nextAttemptAt: later(now, 15_000),
        lastError: error.message,
        lockedUntil: null,
      },
    ]);
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.WARN,
        event: SharedLogEvent.OutboxEffectFailed.name,
        fields: { id: effect.id, type, attempts: 1, error },
      },
    ]);
  });

  it("keeps a rejection that is not an Error as text", async () => {
    const reason = faker.lorem.sentence();
    await recordOne();
    handle.mockRejectedValueOnce(reason);

    await relay.relayNext();

    expect(outbox.effects()[0].lastError).toBe(reason);
  });

  it.each([
    [1, 15_000],
    [2, 30_000],
    [3, 60_000],
    [4, 120_000],
    [5, 240_000],
    [6, 480_000],
    [7, 900_000],
  ])(
    "waits a random share of min(30 min, 30 s × 2^(attempts − 1)) after failure %i: %i ms at 0.5",
    async (attempts, waitMs) => {
      await withAttempts(attempts - 1);
      handle.mockRejectedValueOnce(new Error(faker.lorem.sentence()));
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const now = clock.now();

      await relay.relayNext();

      expect(outbox.effects()[0]).toMatchObject({
        attempts,
        nextAttemptAt: later(now, waitMs),
        failedAt: null,
      });
    },
  );

  it("never waits the whole backoff", async () => {
    await recordOne();
    handle.mockRejectedValueOnce(new Error(faker.lorem.sentence()));
    vi.spyOn(Math, "random").mockReturnValue(0.999_999);
    const now = clock.now();

    await relay.relayNext();

    expect(outbox.effects()[0].nextAttemptAt).toStrictEqual(later(now, 29_999));
  });

  it("abandons the effect when the 8th attempt fails", async () => {
    const effect = await withAttempts(7);
    const error = new Error(faker.lorem.sentence());
    handle.mockRejectedValueOnce(error);
    const now = clock.now();

    await relay.relayNext();

    expect(outbox.effects()).toStrictEqual([
      {
        ...effect,
        attempts: 8,
        payload: null,
        lockedUntil: null,
        lastError: error.message,
        failedAt: now,
        expiresAt: later(now, SEVEN_DAYS_MS),
      },
    ]);
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.OutboxEffectAbandoned.name,
        fields: { id: effect.id, type, attempts: 8 },
      },
    ]);
  });

  it("abandons at once an effect whose payload its consumer refuses", async () => {
    const effect = await recordOne();
    handle.mockRejectedValueOnce(
      new AppError(SharedError.InputInvalid, {
        violations: [{ field: faker.lorem.word(), reason: "required" }],
      }),
    );
    const now = clock.now();

    await relay.relayNext();

    expect(outbox.effects()).toStrictEqual([
      {
        ...effect,
        attempts: 1,
        payload: null,
        lockedUntil: null,
        lastError: SharedError.InputInvalid.code,
        failedAt: now,
        expiresAt: later(now, SEVEN_DAYS_MS),
      },
    ]);
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.OutboxEffectAbandoned.name,
        fields: { id: effect.id, type, attempts: 1 },
      },
    ]);
  });

  it("abandons an effect whose type has no handler", async () => {
    const unknown = `${faker.lorem.word()}.${faker.string.alpha(12)}`;
    const effect = await recordOne(buildPayload(), unknown);
    const now = clock.now();

    const relayed = await relay.relayNext();

    expect(relayed).toBe(true);
    expect(outbox.effects()).toStrictEqual([
      {
        ...effect,
        attempts: 1,
        payload: null,
        lockedUntil: null,
        lastError: expect.any(String) as string,
        failedAt: now,
        expiresAt: later(now, SEVEN_DAYS_MS),
      },
    ]);
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.OutboxEffectAbandoned.name,
        fields: { id: effect.id, type: unknown, attempts: 1 },
      },
    ]);
    expect(handle).not.toHaveBeenCalled();
  });

  describe("running", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
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

    it("looks for the next effect right after relaying one", async () => {
      const reserve = vi.spyOn(outbox, "reserve");
      const first = buildPayload();
      const second = buildPayload();
      await recordOne(first);
      await recordOne(second);

      relay.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(handle.mock.calls).toStrictEqual([[first], [second]]);
      expect(reserve).toHaveBeenCalledTimes(3);
    });

    it("starts once when asked twice", async () => {
      const reserve = vi.spyOn(outbox, "reserve");

      relay.start();
      relay.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(reserve).toHaveBeenCalledTimes(1);
    });

    it("finishes the effect in progress before stop resolves", async () => {
      await recordOne();
      await recordOne();
      const reserve = vi.spyOn(outbox, "reserve");
      let finish = () => {};
      handle.mockReturnValueOnce(
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
      expect(outbox.effects()[0].processedAt).toStrictEqual(clock.now());
      expect(outbox.effects()[1].processedAt).toBeNull();
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
