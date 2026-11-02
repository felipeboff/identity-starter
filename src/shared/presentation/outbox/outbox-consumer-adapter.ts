import type {
  OutboxDelivery,
  OutboxEffectHandlers,
} from "../../application/ports/outbox";
import type { Dispatcher } from "../dispatcher";

import { type OutboxConsumer, OutboxMetadata } from "./outbox-consumer";

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
          handle: (delivery: OutboxDelivery) =>
            this.dispatch(consumer, delivery),
        },
      ]),
    );
  }

  private async dispatch(
    consumer: OutboxConsumer,
    delivery: OutboxDelivery,
  ): Promise<void> {
    await this.deps.dispatcher.dispatch(consumer, {
      input: delivery.payload,
      metadata: { [OutboxMetadata.EFFECT_ID]: delivery.id },
      ip: "",
      actor: undefined,
    });
  }
}
