import { faker } from "@faker-js/faker";
import Type from "typebox";
import { describe, expect, it } from "vitest";

import { SharedError } from "../../domain/errors/shared.error";
import { expectAppError } from "../../testing/expect-app-error";
import { dateSchema } from "../date.schema";
import { Dispatcher } from "../dispatcher";
import { Handler, type Inbound } from "../handler";
import { SchemaParser } from "../schema-parser";

import { OutboxMetadata } from "./outbox-consumer";
import { OutboxConsumerAdapter } from "./outbox-consumer-adapter";

const inputSchema = Type.Object({
  to: Type.String({ format: "email" }),
  at: dateSchema,
});

type Input = Type.StaticDecode<typeof inputSchema>;

class RecordingHandler extends Handler<{ input: typeof inputSchema }> {
  readonly name = `${faker.lorem.word()}.${faker.lorem.word()}`;
  readonly input = inputSchema;
  readonly received: Inbound<undefined, Input>[] = [];

  handle(inbound: Inbound<undefined, Input>): Promise<void> {
    this.received.push(inbound);
    return Promise.resolve();
  }
}

const buildType = () => `${faker.lorem.word()}.${faker.string.alpha(12)}`;

describe("OutboxConsumerAdapter", () => {
  const adapter = new OutboxConsumerAdapter({
    dispatcher: new Dispatcher({ parser: new SchemaParser() }),
  });

  it("dispatches the payload to the consumer of its type, decoded by its schema, with the effect id", async () => {
    const first = { type: buildType(), handler: new RecordingHandler() };
    const second = { type: buildType(), handler: new RecordingHandler() };
    const id = faker.database.mongodbObjectId();
    const input = { to: faker.internet.email(), at: faker.date.soon() };
    const handlers = adapter.toHandlers([first, second]);

    await handlers[second.type].handle({
      id,
      payload: { ...input, [faker.string.alpha(12)]: faker.lorem.word() },
    });

    expect(Object.keys(handlers)).toStrictEqual([first.type, second.type]);
    expect(first.handler.received).toStrictEqual([]);
    expect(second.handler.received).toStrictEqual([
      {
        input,
        metadata: { [OutboxMetadata.EFFECT_ID]: id },
        ip: "",
        actor: undefined,
      },
    ]);
  });

  it("refuses a payload outside the consumer's schema", async () => {
    const consumer = { type: buildType(), handler: new RecordingHandler() };
    const handlers = adapter.toHandlers([consumer]);

    await expectAppError(
      handlers[consumer.type].handle({
        id: faker.database.mongodbObjectId(),
        payload: { to: faker.lorem.word(), at: faker.lorem.word() },
      }),
      SharedError.InputInvalid,
      {
        violations: [
          { field: "to", reason: "format" },
          { field: "at", reason: "~refine" },
        ],
      },
    );
    expect(consumer.handler.received).toStrictEqual([]);
  });
});
