import { once } from "node:events";

import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import type { MessageHandler } from "@shared/application/ports/message-subscription";
import {
  MessageOutcome,
  MessageRunner,
} from "@shared/application/services/message-runner";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { FakeClock } from "@shared/testing/fake-clock";
import { FakeLogger } from "@shared/testing/fake-logger";
import { InMemoryInbox } from "@shared/testing/in-memory-inbox";
import { InMemoryTransactionRunner } from "@shared/testing/in-memory-transaction-runner";
import { useRabbitMq } from "@shared/testing/rabbitmq-broker";
import type { GetMessage } from "amqplib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RabbitConnection } from "./rabbit-connection";
import { RabbitEventBroker } from "./rabbit-event-broker";
import {
  RabbitHeader,
  RabbitMessageConsumers,
} from "./rabbit-message-consumers";

type Subscriber = Readonly<{
  consumer: string;
  handle: ReturnType<typeof vi.fn<MessageHandler["handle"]>>;
}>;

describe("RabbitMessageConsumers", () => {
  const broker = useRabbitMq();
  const closing: (() => Promise<void>)[] = [];

  afterEach(async () => {
    for (const close of closing.splice(0).reverse()) await close();
    vi.restoreAllMocks();
  });

  const buildSubscriber = (): Subscriber => ({
    consumer: `${faker.lorem.word()}.${faker.string.alpha(12)}`,
    handle: vi.fn<MessageHandler["handle"]>().mockResolvedValue(),
  });

  const buildEvent = (type: string) => ({
    id: faker.database.mongodbObjectId(),
    type,
    payload: { accountId: faker.database.mongodbObjectId() },
  });

  const eventName = () =>
    `${faker.lorem.word()}.${faker.lorem.word()}.${faker.string.alpha(12)}`;

  const connect = async () => {
    const connection = new RabbitConnection({
      url: broker.url(),
      logger: new FakeLogger(),
      reconnectMs: 50,
    });
    await connection.connect();
    closing.push(() => connection.close());
    return connection;
  };

  const createConsumers = async (
    prefix: string,
    event: string,
    subscribers: Subscriber[],
  ) => {
    const connection = await connect();
    const logger = new FakeLogger();
    const transactions = new InMemoryTransactionRunner();
    const runner = new MessageRunner({
      inbox: new InMemoryInbox(transactions),
      transactions,
      clock: new FakeClock(),
      logger,
    });
    const consumers = new RabbitMessageConsumers({
      connection,
      prefix,
      subscriptions: subscribers.map((subscriber) => ({
        event,
        consumer: subscriber.consumer,
        handler: { handle: subscriber.handle },
      })),
      runner,
      logger,
    });
    closing.push(() => consumers.close());
    return { connection, consumers, runner, logger };
  };

  const startConsumers = async (event: string, subscribers: Subscriber[]) => {
    const prefix = faker.string.alpha({ length: 12, casing: "lower" });
    const { connection, consumers, runner, logger } = await createConsumers(
      prefix,
      event,
      subscribers,
    );
    await consumers.start();
    const events = new RabbitEventBroker({
      connection,
      prefix,
      clock: new FakeClock(),
      logger: new FakeLogger(),
    });
    closing.push(() => events.close());
    return { prefix, connection, consumers, runner, logger, events };
  };

  const dropAndReconnect = async (connection: RabbitConnection) => {
    const reconnected = once(connection.manager, "connect");
    await broker.dropConnections();
    await reconnected;
  };

  const readyIn = async (queue: string) =>
    (await broker.channel().checkQueue(queue)).messageCount;

  it("declares the exchange, the dead-letter queue and each subscriber's queues", async () => {
    const event = eventName();
    const subscribers = [buildSubscriber(), buildSubscriber()];

    const { prefix } = await startConsumers(event, subscribers);

    const channel = broker.channel();
    await expect(
      channel.assertExchange(`${prefix}.events`, "topic", { durable: true }),
    ).resolves.toStrictEqual({ exchange: `${prefix}.events` });
    await expect(
      channel.assertQueue(`${prefix}.dead`, { durable: true }),
    ).resolves.toStrictEqual({
      queue: `${prefix}.dead`,
      messageCount: 0,
      consumerCount: 0,
    });
    for (const subscriber of subscribers) {
      await expect(
        channel.assertQueue(`${prefix}.${subscriber.consumer}`, {
          durable: true,
          arguments: { "x-queue-type": "quorum" },
        }),
      ).resolves.toStrictEqual({
        queue: `${prefix}.${subscriber.consumer}`,
        messageCount: 0,
        consumerCount: 1,
      });
    }
  });

  it("logs a subscriber's queue it cannot declare", async () => {
    const prefix = faker.string.alpha({ length: 12, casing: "lower" });
    const subscriber = buildSubscriber();
    await broker
      .channel()
      .assertQueue(`${prefix}.${subscriber.consumer}`, { durable: true });

    const { consumers, logger } = await createConsumers(prefix, eventName(), [
      subscriber,
    ]);
    void consumers.start();

    await vi.waitFor(() => {
      expect(logger.entries).toContainEqual({
        level: LogLevel.ERROR,
        event: SharedLogEvent.BrokerChannelFailed.name,
        fields: { channel: "subscribers", error: expect.any(Error) as Error },
      });
    });
  });

  it("hands a message to its handler and acknowledges it", async () => {
    const subscriber = buildSubscriber();
    const event = buildEvent(eventName());
    const { prefix, consumers, events } = await startConsumers(event.type, [
      subscriber,
    ]);

    await events.send(event);
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledOnce();
    });
    await consumers.close();

    expect(subscriber.handle.mock.calls).toStrictEqual([
      [{ id: event.id, payload: event.payload }],
    ]);
    expect(await readyIn(`${prefix}.${subscriber.consumer}`)).toBe(0);
  });

  it("hands a content that is not JSON to its handler as text", async () => {
    const subscriber = buildSubscriber();
    const event = eventName();
    const { prefix } = await startConsumers(event, [subscriber]);
    const id = faker.database.mongodbObjectId();
    const content = faker.lorem.sentence();

    broker.channel().publish(`${prefix}.events`, event, Buffer.from(content), {
      messageId: id,
    });
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledOnce();
    });

    expect(subscriber.handle.mock.calls).toStrictEqual([
      [{ id, payload: content }],
    ]);
  });

  it("gives each subscriber its own copy", async () => {
    const subscribers = [buildSubscriber(), buildSubscriber()];
    const event = buildEvent(eventName());
    const { events } = await startConsumers(event.type, subscribers);

    await events.send(event);
    await vi.waitFor(() => {
      for (const subscriber of subscribers) {
        expect(subscriber.handle).toHaveBeenCalledOnce();
      }
    });

    for (const subscriber of subscribers) {
      expect(subscriber.handle.mock.calls).toStrictEqual([
        [{ id: event.id, payload: event.payload }],
      ]);
    }
  });

  it("acknowledges a duplicate without running the handler again", async () => {
    const subscriber = buildSubscriber();
    const event = buildEvent(eventName());
    const { prefix, consumers, runner, events } = await startConsumers(
      event.type,
      [subscriber],
    );
    const run = vi.spyOn(runner, "run");

    await events.send(event);
    await events.send(event);
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledTimes(2);
    });
    await consumers.close();

    expect(subscriber.handle).toHaveBeenCalledOnce();
    expect(await readyIn(`${prefix}.${subscriber.consumer}`)).toBe(0);
  });

  it("acknowledges a refused message without another delivery", async () => {
    const subscriber = buildSubscriber();
    subscriber.handle.mockRejectedValue(
      new AppError(SharedError.InputInvalid, { violations: [] }),
    );
    const event = buildEvent(eventName());
    const { prefix, consumers, logger, events } = await startConsumers(
      event.type,
      [subscriber],
    );

    await events.send(event);
    await vi.waitFor(() => {
      expect(logger.entries).toHaveLength(1);
    });
    await consumers.close();

    expect(subscriber.handle).toHaveBeenCalledOnce();
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.WARN,
        event: SharedLogEvent.MessageRefused.name,
        fields: {
          event: event.type,
          consumer: subscriber.consumer,
          id: event.id,
          code: SharedError.InputInvalid.code,
        },
      },
    ]);
    expect(await readyIn(`${prefix}.${subscriber.consumer}`)).toBe(0);
  });

  it("redelivers a failed message with the next attempt number", async () => {
    const subscriber = buildSubscriber();
    subscriber.handle.mockRejectedValueOnce(new Error(faker.lorem.sentence()));
    const event = buildEvent(eventName());
    const { runner, logger, events } = await startConsumers(event.type, [
      subscriber,
    ]);
    const run = vi.spyOn(runner, "run");

    await events.send(event);
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledTimes(2);
    });

    expect(run.mock.calls.map(([attempt]) => attempt.attempt)).toStrictEqual([
      1, 2,
    ]);
    expect(subscriber.handle.mock.calls).toStrictEqual([
      [{ id: event.id, payload: event.payload }],
      [{ id: event.id, payload: event.payload }],
    ]);
    expect(logger.entries.map((entry) => entry.event)).toStrictEqual([
      SharedLogEvent.MessageFailed.name,
    ]);
  });

  it("moves a message to the dead-letter queue after 5 failures", async () => {
    const subscriber = buildSubscriber();
    subscriber.handle.mockRejectedValue(new Error(faker.lorem.sentence()));
    const event = buildEvent(eventName());
    const { prefix, consumers, logger, events } = await startConsumers(
      event.type,
      [subscriber],
    );

    await events.send(event);
    let dead: GetMessage | false = false;
    await vi.waitFor(async () => {
      dead = await broker.channel().get(`${prefix}.dead`, { noAck: true });
      expect(dead).not.toBe(false);
    });
    await consumers.close();

    const message = dead as unknown as GetMessage;
    expect(subscriber.handle).toHaveBeenCalledTimes(5);
    expect(message.properties).toMatchObject({
      messageId: event.id,
      type: event.type,
      headers: {
        [RabbitHeader.ATTEMPT]: 5,
        [RabbitHeader.CONSUMER]: subscriber.consumer,
      },
    });
    expect(JSON.parse(message.content.toString())).toStrictEqual(event.payload);
    expect(logger.entries.map((entry) => entry.event)).toStrictEqual([
      ...Array<string>(4).fill(SharedLogEvent.MessageFailed.name),
      SharedLogEvent.MessageDeadLettered.name,
    ]);
    expect(await readyIn(`${prefix}.${subscriber.consumer}`)).toBe(0);
  });

  it("waits for the message in progress before it closes", async () => {
    const subscriber = buildSubscriber();
    let finish = () => {};
    subscriber.handle.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const event = buildEvent(eventName());
    const { prefix, consumers, events } = await startConsumers(event.type, [
      subscriber,
    ]);
    await events.send(event);
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledOnce();
    });

    let closed = false;
    const closingConsumers = consumers.close().then(() => {
      closed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const closedBeforeFinish = closed;
    finish();
    await closingConsumers;

    expect(closedBeforeFinish).toBe(false);
    expect(await readyIn(`${prefix}.${subscriber.consumer}`)).toBe(0);
  });

  it("consumes again after the connection drops", async () => {
    const subscriber = buildSubscriber();
    const first = buildEvent(eventName());
    const { events, connection } = await startConsumers(first.type, [
      subscriber,
    ]);
    await events.send(first);
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledOnce();
    });

    await dropAndReconnect(connection);
    const second = buildEvent(first.type);
    await events.send(second);
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledTimes(2);
    });

    expect(subscriber.handle.mock.calls[1]).toStrictEqual([
      { id: second.id, payload: second.payload },
    ]);
  });

  it("keeps consuming when a message received before the connection dropped finishes after it came back", async () => {
    const subscriber = buildSubscriber();
    let finish = () => {};
    subscriber.handle.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const first = buildEvent(eventName());
    const { events, connection, runner } = await startConsumers(first.type, [
      subscriber,
    ]);
    const run = vi.spyOn(runner, "run");
    await events.send(first);
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledOnce();
    });

    await dropAndReconnect(connection);
    await vi.waitFor(async () => {
      expect(await run.mock.results[1]?.value).toBe(MessageOutcome.DUPLICATE);
    });
    finish();
    const second = buildEvent(first.type);
    await events.send(second);
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledTimes(2);
    });

    expect(subscriber.handle.mock.calls).toStrictEqual([
      [{ id: first.id, payload: first.payload }],
      [{ id: second.id, payload: second.payload }],
    ]);
  });

  it("leaves a message it could not settle for the broker to deliver again", async () => {
    const subscriber = buildSubscriber();
    const event = buildEvent(eventName());
    const { runner, logger, events } = await startConsumers(event.type, [
      subscriber,
    ]);
    const error = new Error(faker.lorem.sentence());
    vi.spyOn(runner, "run").mockRejectedValueOnce(error);

    await events.send(event);
    await vi.waitFor(() => {
      expect(logger.entries).toHaveLength(1);
    });
    await broker.dropConnections();
    await vi.waitFor(() => {
      expect(subscriber.handle).toHaveBeenCalledOnce();
    });

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.MessageUnsettled.name,
        fields: {
          event: event.type,
          consumer: subscriber.consumer,
          id: event.id,
          error,
        },
      },
    ]);
    expect(subscriber.handle.mock.calls).toStrictEqual([
      [{ id: event.id, payload: event.payload }],
    ]);
  });
});
