import type {
  OutboxEffectHandlers,
  OutboxPayload,
} from "../../application/ports/outbox";
import type { Dispatcher } from "../dispatcher";

import type { OutboxConsumer } from "./outbox-consumer";

export type OutboxConsumerAdapterDeps = Readonly<{
  dispatcher: Dispatcher;
}>;

export class OutboxConsumerAdapter {
  constructor(private readonly deps: OutboxConsumerAdapterDeps) {}

  toHandlers(consumers: readonly OutboxConsumer[]): OutboxEffectHandlers {
    return Object.fromEntries(
      consumers.map((consumer) => [
        consumer.type,
        {
          handle: (payload: OutboxPayload) => this.dispatch(consumer, payload),
        },
      ]),
    );
  }

  private async dispatch(
    consumer: OutboxConsumer,
    payload: OutboxPayload,
  ): Promise<void> {
    await this.deps.dispatcher.dispatch(consumer, {
      input: payload,
      metadata: {},
      ip: "",
      actor: undefined,
    });
  }
}
