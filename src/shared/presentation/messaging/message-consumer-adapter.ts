import type {
  MessageDelivery,
  MessageSubscription,
} from "../../application/ports/message-subscription";
import type { Dispatcher } from "../dispatcher";

import { type MessageConsumer, MessageMetadata } from "./message-consumer";

export type MessageConsumerAdapterDeps = Readonly<{
  dispatcher: Dispatcher;
}>;

export class MessageConsumerAdapter {
  constructor(private readonly deps: MessageConsumerAdapterDeps) {}

  toSubscriptions(
    consumers: readonly MessageConsumer[],
  ): readonly MessageSubscription[] {
    return consumers.map((consumer) => ({
      event: consumer.event,
      consumer: consumer.handler.name,
      handler: {
        handle: (delivery: MessageDelivery) =>
          this.dispatch(consumer, delivery),
      },
    }));
  }

  private async dispatch(
    consumer: MessageConsumer,
    delivery: MessageDelivery,
  ): Promise<void> {
    await this.deps.dispatcher.dispatch(consumer, {
      input: delivery.payload,
      metadata: { [MessageMetadata.EVENT_ID]: delivery.id },
      ip: "",
      actor: undefined,
    });
  }
}
