import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../domain/errors/app-error";
import { SharedError } from "../../domain/errors/shared.error";
import { FakeClock } from "../../testing/fake-clock";
import { FakeLogger } from "../../testing/fake-logger";
import { InMemoryOutbox } from "../../testing/in-memory-outbox";
import { InMemoryTransactionRunner } from "../../testing/in-memory-transaction-runner";
import { SharedLogEvent } from "../logging/shared.log-event";
import { LogLevel } from "../ports/logger";
import type { OutboxEffectHandler } from "../ports/outbox";

import { OutboxEffectRunner, OutboxRunOutcome } from "./outbox-effect-runner";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_ATTEMPTS = 8;

const later = (date: Date, ms: number) => new Date(date.getTime() + ms);

describe("OutboxEffectRunner", () => {
  let clock: FakeClock;
  let outbox: InMemoryOutbox;
  let logger: FakeLogger;
  let handle: ReturnType<typeof vi.fn<OutboxEffectHandler["handle"]>>;
  let type: string;
  let runner: OutboxEffectRunner;

  beforeEach(() => {
    clock = new FakeClock();
    outbox = new InMemoryOutbox({
      transactions: new InMemoryTransactionRunner(),
      clock,
    });
    logger = new FakeLogger();
    handle = vi.fn<OutboxEffectHandler["handle"]>().mockResolvedValue();
    type = `${faker.lorem.word()}.${faker.lorem.word()}`;
    runner = new OutboxEffectRunner({
      store: outbox,
      handlers: { [type]: { handle } },
      clock,
      logger,
    });
  });

  const recordOne = async (effectType = type) => {
    const payload = {
      to: faker.internet.email(),
      token: faker.string.alphanumeric(32),
    };
    await outbox.record({ type: effectType, payload });
    return outbox.effects().at(-1)!;
  };

  const attemptOf = (
    effect: Awaited<ReturnType<typeof recordOne>>,
    attempt = 1,
  ) => ({
    id: effect.id,
    type: effect.type,
    payload: effect.payload!,
    attempt,
    maxAttempts: MAX_ATTEMPTS,
  });

  it("marks the effect processed when its handler finishes", async () => {
    const effect = await recordOne();
    const now = clock.now();

    const result = await runner.run(attemptOf(effect));

    expect(result).toStrictEqual({ outcome: OutboxRunOutcome.PROCESSED });
    expect(handle.mock.calls).toStrictEqual([
      [{ id: effect.id, payload: effect.payload }],
    ]);
    expect(outbox.effects()).toStrictEqual([
      {
        ...effect,
        payload: null,
        lockedUntil: null,
        processedAt: now,
        expiresAt: later(now, SEVEN_DAYS_MS),
      },
    ]);
    expect(logger.entries).toStrictEqual([]);
  });

  it("logs the failure and asks for another attempt before the last one", async () => {
    const effect = await recordOne();
    const attempt = faker.number.int({ min: 1, max: MAX_ATTEMPTS - 1 });
    const error = new Error(faker.lorem.sentence());
    handle.mockRejectedValueOnce(error);

    const result = await runner.run(attemptOf(effect, attempt));

    expect(result).toStrictEqual({ outcome: OutboxRunOutcome.RETRY, error });
    expect(outbox.effects()).toStrictEqual([effect]);
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.WARN,
        event: SharedLogEvent.OutboxEffectFailed.name,
        fields: { id: effect.id, type, attempts: attempt, error },
      },
    ]);
  });

  it("abandons the effect when the last attempt fails", async () => {
    const effect = await recordOne();
    const error = new Error(faker.lorem.sentence());
    handle.mockRejectedValueOnce(error);
    const now = clock.now();

    const result = await runner.run(attemptOf(effect, MAX_ATTEMPTS));

    expect(result).toStrictEqual({
      outcome: OutboxRunOutcome.ABANDONED,
      reason: error.message,
    });
    expect(outbox.effects()).toStrictEqual([
      {
        ...effect,
        attempts: MAX_ATTEMPTS,
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
        fields: { id: effect.id, type, attempts: MAX_ATTEMPTS },
      },
    ]);
  });

  it("keeps a rejection that is not an Error as text", async () => {
    const effect = await recordOne();
    const reason = faker.lorem.sentence();
    handle.mockRejectedValueOnce(reason);

    await runner.run(attemptOf(effect, MAX_ATTEMPTS));

    expect(outbox.effects()[0].lastError).toBe(reason);
  });

  describe("abandons at once", () => {
    it("an effect whose payload its consumer refuses", async () => {
      const effect = await recordOne();
      handle.mockRejectedValueOnce(
        new AppError(SharedError.InputInvalid, {
          violations: [{ field: faker.lorem.word(), reason: "required" }],
        }),
      );
      const now = clock.now();

      const result = await runner.run(attemptOf(effect));

      expect(result).toStrictEqual({
        outcome: OutboxRunOutcome.ABANDONED,
        reason: SharedError.InputInvalid.code,
      });
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

    it("an effect whose type has no handler", async () => {
      const unknown = `${faker.lorem.word()}.${faker.string.alpha(12)}`;
      const effect = await recordOne(unknown);
      const now = clock.now();

      const result = await runner.run(attemptOf(effect));

      expect(result).toMatchObject({ outcome: OutboxRunOutcome.ABANDONED });
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
  });
});
