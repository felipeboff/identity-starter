import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { FakeClock } from "@shared/testing/fake-clock";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useRabbitMq } from "@shared/testing/rabbitmq-broker";
import type { GetMessage } from "amqplib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RabbitConnection } from "./rabbit-connection";
import { RabbitEventBroker } from "./rabbit-event-broker";

describe("RabbitEventBroker", () => {
  const broker = useRabbitMq();
  const closing: (() => Promise<void>)[] = [];

  afterEach(async () => {
    for (const close of closing.splice(0).reverse()) await close();
  });

  const buildEvent = () => ({
    id: faker.database.mongodbObjectId(),
    type: `${faker.lorem.word()}.${faker.lorem.word()}.${faker.lorem.word()}`,
    payload: {
      accountId: faker.database.mongodbObjectId(),
      email: faker.internet.email(),
    },
  });

  const createEventBroker = async (
    prefix: string,
    clock = new FakeClock(),
    logger = new FakeLogger(),
  ) => {
    const connection = new RabbitConnection({
      url: broker.url(),
      logger: new FakeLogger(),
    });
    await connection.connect();
    closing.push(() => connection.close());
    const events = new RabbitEventBroker({ connection, prefix, clock, logger });
    closing.push(() => events.close());
    return events;
  };

  const bindTestQueue = async (prefix: string, routingKey: string) => {
    const channel = broker.channel();
    await channel.assertExchange(`${prefix}.events`, "topic", {
      durable: true,
    });
    const { queue } = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(queue, `${prefix}.events`, routingKey);
    return queue;
  };

  const nextMessage = async (queue: string) => {
    let message: GetMessage | false = false;
    await vi.waitFor(async () => {
      message = await broker.channel().get(queue, { noAck: true });
      expect(message).not.toBe(false);
    });
    return message as unknown as GetMessage;
  };

  it("publishes the event on the events exchange with its id and name", async () => {
    const prefix = faker.string.alpha({ length: 12, casing: "lower" });
    const event = buildEvent();
    const clock = new FakeClock();
    const queue = await bindTestQueue(prefix, event.type);
    const events = await createEventBroker(prefix, clock);

    await events.send(event);

    const message = await nextMessage(queue);
    expect(message.fields).toMatchObject({
      exchange: `${prefix}.events`,
      routingKey: event.type,
    });
    expect(message.properties).toMatchObject({
      messageId: event.id,
      type: event.type,
      timestamp: Math.floor(clock.now().getTime() / 1_000),
      contentType: "application/json",
      deliveryMode: 2,
    });
    expect(JSON.parse(message.content.toString())).toStrictEqual(event.payload);
  });

  it("declares the events exchange as a durable topic exchange", async () => {
    const prefix = faker.string.alpha({ length: 12, casing: "lower" });
    const events = await createEventBroker(prefix);

    await events.send(buildEvent());

    await expect(
      broker
        .channel()
        .assertExchange(`${prefix}.events`, "topic", { durable: true }),
    ).resolves.toStrictEqual({ exchange: `${prefix}.events` });
  });

  it("is ready once its channel has declared the events exchange", async () => {
    const prefix = faker.string.alpha({ length: 12, casing: "lower" });
    const events = await createEventBroker(prefix);

    await events.ready();

    await expect(
      broker.channel().checkExchange(`${prefix}.events`),
    ).resolves.toStrictEqual({});
  });

  it("logs an events exchange it cannot declare", async () => {
    const prefix = faker.string.alpha({ length: 12, casing: "lower" });
    await broker
      .channel()
      .assertExchange(`${prefix}.events`, "direct", { durable: true });
    const logger = new FakeLogger();

    await createEventBroker(prefix, new FakeClock(), logger);

    await vi.waitFor(() => {
      expect(logger.entries).toContainEqual({
        level: LogLevel.ERROR,
        event: SharedLogEvent.BrokerChannelFailed.name,
        fields: { channel: "events", error: expect.any(Error) as Error },
      });
    });
  });

  it("fails a publish when the broker is away instead of waiting for it", async () => {
    const connection = new RabbitConnection({
      url: broker.url(),
      logger: new FakeLogger(),
    });
    closing.push(() => connection.close());
    const events = new RabbitEventBroker({
      connection,
      prefix: faker.string.alpha({ length: 12, casing: "lower" }),
      clock: new FakeClock(),
      logger: new FakeLogger(),
      publishTimeoutMs: 200,
    });
    closing.push(() => events.close());

    await expect(events.send(buildEvent())).rejects.toThrow(/timeout/i);
  });
});
