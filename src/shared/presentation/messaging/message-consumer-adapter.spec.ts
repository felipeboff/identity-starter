import { faker } from "@faker-js/faker";
import Type from "typebox";
import { describe, expect, it } from "vitest";

import { SharedError } from "../../domain/errors/shared.error";
import { expectAppError } from "../../testing/expect-app-error";
import { dateSchema } from "../date.schema";
import { Dispatcher } from "../dispatcher";
import { Handler, type Inbound } from "../handler";
import { SchemaParser } from "../schema-parser";

import { MessageMetadata } from "./message-consumer";
import { MessageConsumerAdapter } from "./message-consumer-adapter";

const inputSchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  at: dateSchema,
});

type Input = Type.StaticDecode<typeof inputSchema>;

class RecordingHandler extends Handler<{ input: typeof inputSchema }> {
  readonly name = `${faker.lorem.word()}.${faker.string.alpha(12)}`;
  readonly input = inputSchema;
  readonly received: Inbound<undefined, Input>[] = [];

  handle(inbound: Inbound<undefined, Input>): Promise<void> {
    this.received.push(inbound);
    return Promise.resolve();
  }
}

const buildEvent = () =>
  `${faker.lorem.word()}.${faker.lorem.word()}.${faker.string.alpha(12)}`;

describe("MessageConsumerAdapter", () => {
  const adapter = new MessageConsumerAdapter({
    dispatcher: new Dispatcher({ parser: new SchemaParser() }),
  });

  it("subscribes each consumer to its event under its handler's name", () => {
    const first = { event: buildEvent(), handler: new RecordingHandler() };
    const second = { event: buildEvent(), handler: new RecordingHandler() };

    const subscriptions = adapter.toSubscriptions([first, second]);

    expect(
      subscriptions.map((subscription) => [
        subscription.event,
        subscription.consumer,
      ]),
    ).toStrictEqual([
      [first.event, first.handler.name],
      [second.event, second.handler.name],
    ]);
  });

  it("dispatches the payload to the handler with the event id, decoded by its schema", async () => {
    const first = { event: buildEvent(), handler: new RecordingHandler() };
    const second = { event: buildEvent(), handler: new RecordingHandler() };
    const id = faker.database.mongodbObjectId();
    const input = {
      accountId: faker.database.mongodbObjectId(),
      at: faker.date.recent(),
    };
    const [, subscription] = adapter.toSubscriptions([first, second]);

    await subscription.handler.handle({
      id,
      payload: {
        accountId: input.accountId,
        at: input.at.toISOString(),
        [faker.string.alpha(12)]: faker.lorem.word(),
      },
    });

    expect(first.handler.received).toStrictEqual([]);
    expect(second.handler.received).toStrictEqual([
      {
        input,
        metadata: { [MessageMetadata.EVENT_ID]: id },
        ip: "",
        actor: undefined,
      },
    ]);
  });

  it("refuses a payload outside the consumer's schema", async () => {
    const consumer = { event: buildEvent(), handler: new RecordingHandler() };
    const [subscription] = adapter.toSubscriptions([consumer]);

    await expectAppError(
      subscription.handler.handle({
        id: faker.database.mongodbObjectId(),
        payload: { accountId: "", at: faker.lorem.word() },
      }),
      SharedError.InputInvalid,
      {
        violations: [
          { field: "accountId", reason: "minLength" },
          { field: "at", reason: "~refine" },
        ],
      },
    );
    expect(consumer.handler.received).toStrictEqual([]);
  });
});
