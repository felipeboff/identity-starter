import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../domain/errors/app-error";
import { SharedError } from "../../domain/errors/shared.error";
import { FakeClock } from "../../testing/fake-clock";
import { FakeLogger } from "../../testing/fake-logger";
import { InMemoryInbox } from "../../testing/in-memory-inbox";
import { InMemoryOutbox } from "../../testing/in-memory-outbox";
import { InMemoryTransactionRunner } from "../../testing/in-memory-transaction-runner";
import { SharedLogEvent } from "../logging/shared.log-event";
import { LogLevel } from "../ports/logger";
import type { MessageHandler } from "../ports/message-subscription";
import { OutboxKind } from "../ports/outbox";

import { MessageOutcome, MessageRunner } from "./message-runner";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

describe("MessageRunner", () => {
  let clock: FakeClock;
  let transactions: InMemoryTransactionRunner;
  let inbox: InMemoryInbox;
  let logger: FakeLogger;
  let handle: ReturnType<typeof vi.fn<MessageHandler["handle"]>>;
  let runner: MessageRunner;

  beforeEach(() => {
    clock = new FakeClock();
    transactions = new InMemoryTransactionRunner();
    inbox = new InMemoryInbox(transactions);
    logger = new FakeLogger();
    handle = vi.fn<MessageHandler["handle"]>().mockResolvedValue();
    runner = new MessageRunner({ inbox, transactions, clock, logger });
  });

  const buildAttempt = (attempt = 1) => ({
    subscription: {
      event: `${faker.lorem.word()}.${faker.lorem.word()}.${faker.lorem.word()}`,
      consumer: `${faker.lorem.word()}.${faker.string.alpha(12)}`,
      handler: { handle },
    },
    id: faker.database.mongodbObjectId(),
    payload: { accountId: faker.database.mongodbObjectId() },
    attempt,
  });

  const fieldsOf = (attempt: ReturnType<typeof buildAttempt>) => ({
    event: attempt.subscription.event,
    consumer: attempt.subscription.consumer,
    id: attempt.id,
  });

  it("hands the payload to the handler with the event id and keeps the inbox entry", async () => {
    const attempt = buildAttempt();
    const processedAt = clock.now();

    const outcome = await runner.run(attempt);

    expect(outcome).toBe(MessageOutcome.HANDLED);
    expect(handle.mock.calls).toStrictEqual([
      [{ id: attempt.id, payload: attempt.payload }],
    ]);
    expect(inbox.entries()).toStrictEqual([
      {
        consumer: attempt.subscription.consumer,
        eventId: attempt.id,
        processedAt,
        expiresAt: new Date(processedAt.getTime() + SEVEN_DAYS_MS),
      },
    ]);
    expect(logger.entries).toStrictEqual([]);
  });

  it("runs a duplicate delivery only once", async () => {
    const attempt = buildAttempt();
    await runner.run(attempt);

    const outcome = await runner.run({
      ...attempt,
      attempt: faker.number.int({ min: 1, max: 5 }),
    });

    expect(outcome).toBe(MessageOutcome.DUPLICATE);
    expect(handle).toHaveBeenCalledOnce();
    expect(inbox.entries()).toHaveLength(1);
  });

  it("runs the same event once for each consumer", async () => {
    const first = buildAttempt();
    const second = {
      ...first,
      subscription: {
        ...first.subscription,
        consumer: `${faker.lorem.word()}.${faker.string.alpha(12)}`,
      },
    };

    const outcomes = [await runner.run(first), await runner.run(second)];

    expect(outcomes).toStrictEqual([
      MessageOutcome.HANDLED,
      MessageOutcome.HANDLED,
    ]);
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it("refuses a message its handler rejects with an AppError", async () => {
    const attempt = buildAttempt(faker.number.int({ min: 1, max: 5 }));
    handle.mockRejectedValueOnce(
      new AppError(SharedError.InputInvalid, { violations: [] }),
    );

    const outcome = await runner.run(attempt);

    expect(outcome).toBe(MessageOutcome.REFUSED);
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.WARN,
        event: SharedLogEvent.MessageRefused.name,
        fields: { ...fieldsOf(attempt), code: SharedError.InputInvalid.code },
      },
    ]);
  });

  it.each([1, 2, 3, 4])(
    "asks for a retry before the 5th failure (attempt %i)",
    async (number) => {
      const attempt = buildAttempt(number);
      const error = new Error(faker.lorem.sentence());
      handle.mockRejectedValueOnce(error);

      const outcome = await runner.run(attempt);

      expect(outcome).toBe(MessageOutcome.RETRY);
      expect(logger.entries).toStrictEqual([
        {
          level: LogLevel.WARN,
          event: SharedLogEvent.MessageFailed.name,
          fields: { ...fieldsOf(attempt), attempts: number, error },
        },
      ]);
    },
  );

  it("dead-letters the message on its 5th failure", async () => {
    const attempt = buildAttempt(5);
    const error = new Error(faker.lorem.sentence());
    handle.mockRejectedValueOnce(error);

    const outcome = await runner.run(attempt);

    expect(outcome).toBe(MessageOutcome.DEAD);
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.MessageDeadLettered.name,
        fields: { ...fieldsOf(attempt), attempts: 5, error },
      },
    ]);
  });

  it("keeps no inbox entry when the handler fails, so the next delivery runs it again", async () => {
    const attempt = buildAttempt();
    handle.mockRejectedValueOnce(new Error(faker.lorem.sentence()));

    await runner.run(attempt);
    const afterFailure = inbox.entries();
    const outcome = await runner.run({ ...attempt, attempt: 2 });

    expect(afterFailure).toStrictEqual([]);
    expect(outcome).toBe(MessageOutcome.HANDLED);
    expect(handle).toHaveBeenCalledTimes(2);
  });

  describe("when the handler's use case opens its own transaction", () => {
    let outbox: InMemoryOutbox;

    beforeEach(() => {
      outbox = new InMemoryOutbox({ transactions, clock });
    });

    const writeInItsOwnTransaction = () =>
      transactions.run(() =>
        outbox.publish({
          kind: OutboxKind.EFFECT,
          type: `${faker.lorem.word()}.${faker.lorem.word()}`,
          payload: { to: faker.internet.email() },
        }),
      );

    it("keeps the handler's writes and the inbox entry in one transaction when it succeeds", async () => {
      handle.mockImplementationOnce(writeInItsOwnTransaction);

      await runner.run(buildAttempt());

      expect(outbox.entries()).toHaveLength(1);
      expect(inbox.entries()).toHaveLength(1);
    });

    it("keeps the handler's writes and the inbox entry in one transaction, dropping both when it fails after its write", async () => {
      handle.mockImplementationOnce(async () => {
        await writeInItsOwnTransaction();
        throw new Error(faker.lorem.sentence());
      });

      const outcome = await runner.run(buildAttempt());

      expect(outcome).toBe(MessageOutcome.RETRY);
      expect(outbox.entries()).toStrictEqual([]);
      expect(inbox.entries()).toStrictEqual([]);
    });
  });
});
