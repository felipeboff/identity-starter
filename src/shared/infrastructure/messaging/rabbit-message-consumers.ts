import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Logger } from "@shared/application/ports/logger";
import type { MessageSubscription } from "@shared/application/ports/message-subscription";
import {
  MessageOutcome,
  type MessageRunner,
} from "@shared/application/services/message-runner";
import type { ChannelWrapper } from "amqp-connection-manager";
import type { ConfirmChannel, ConsumeMessage, Options } from "amqplib";

import type { RabbitConnection } from "./rabbit-connection";
import { RabbitTopology } from "./rabbit-topology";

export const RabbitHeader = {
  ATTEMPT: "x-attempt",
  CONSUMER: "x-consumer",
} as const;

const CHANNEL = "subscribers";
const PREFETCH = 10;

type ChannelLife = { open: boolean };

type Delivery = Readonly<{
  subscription: MessageSubscription;
  message: ConsumeMessage;
  attempt: number;
  channel: ChannelLife;
}>;

export type RabbitMessageConsumersDeps = Readonly<{
  connection: RabbitConnection;
  prefix: string;
  subscriptions: readonly MessageSubscription[];
  runner: MessageRunner;
  logger: Logger;
}>;

export class RabbitMessageConsumers {
  private readonly topology: RabbitTopology;
  private readonly channel: ChannelWrapper;
  private readonly settling = new Set<Promise<void>>();
  private live: ChannelLife = { open: false };

  constructor(private readonly deps: RabbitMessageConsumersDeps) {
    this.topology = new RabbitTopology(deps.prefix);
    this.channel = deps.connection.manager.createChannel({
      name: CHANNEL,
      confirm: true,
      setup: (channel: ConfirmChannel) => this.open(channel),
    });
    this.channel.on("error", (error) => {
      deps.logger.error(SharedLogEvent.BrokerChannelFailed, {
        channel: CHANNEL,
        error,
      });
    });
  }

  async start(): Promise<void> {
    for (const subscription of this.deps.subscriptions) {
      await this.channel.consume(
        this.topology.queueOf(subscription.consumer),
        (message) => this.receive(subscription, message),
        { prefetch: PREFETCH },
      );
    }
    await this.channel.waitForConnect();
  }

  async close(): Promise<void> {
    await this.channel.cancelAll();
    await Promise.all(this.settling);
    await this.channel.close();
  }

  private async open(channel: ConfirmChannel): Promise<void> {
    const live = { open: true };
    channel.on("close", () => {
      live.open = false;
    });
    this.live = live;
    await channel.assertExchange(this.topology.exchange, "topic", {
      durable: true,
    });
    await channel.assertQueue(this.topology.deadQueue, { durable: true });
    for (const subscription of this.deps.subscriptions) {
      const queue = this.topology.queueOf(subscription.consumer);
      await channel.assertQueue(queue, {
        durable: true,
        arguments: { "x-queue-type": "quorum" },
      });
      await channel.bindQueue(
        queue,
        this.topology.exchange,
        subscription.event,
      );
    }
  }

  private receive(
    subscription: MessageSubscription,
    message: ConsumeMessage,
  ): void {
    const attempt = Number(
      message.properties.headers?.[RabbitHeader.ATTEMPT] ?? 1,
    );
    const settling = this.settle({
      subscription,
      message,
      attempt,
      channel: this.live,
    }).finally(() => this.settling.delete(settling));
    this.settling.add(settling);
  }

  private async settle(delivery: Delivery): Promise<void> {
    const id = delivery.message.properties.messageId as string;
    try {
      const outcome = await this.deps.runner.run({
        subscription: delivery.subscription,
        id,
        payload: this.payloadOf(delivery.message),
        attempt: delivery.attempt,
      });
      // Its channel closed meanwhile, so the broker already put it back in the queue.
      if (!delivery.channel.open) return;
      if (outcome === MessageOutcome.RETRY) await this.retry(delivery);
      if (outcome === MessageOutcome.DEAD) await this.deadLetter(delivery);
      this.channel.ack(delivery.message);
    } catch (error) {
      this.deps.logger.error(SharedLogEvent.MessageUnsettled, {
        event: delivery.subscription.event,
        consumer: delivery.subscription.consumer,
        id,
        error,
      });
    }
  }

  private async retry(delivery: Delivery): Promise<void> {
    await this.channel.sendToQueue(
      this.topology.queueOf(delivery.subscription.consumer),
      delivery.message.content,
      this.copyOf(delivery.message, {
        [RabbitHeader.ATTEMPT]: delivery.attempt + 1,
      }),
    );
  }

  private async deadLetter(delivery: Delivery): Promise<void> {
    await this.channel.sendToQueue(
      this.topology.deadQueue,
      delivery.message.content,
      this.copyOf(delivery.message, {
        [RabbitHeader.CONSUMER]: delivery.subscription.consumer,
      }),
    );
  }

  private copyOf(
    message: ConsumeMessage,
    headers: Record<string, unknown>,
  ): Options.Publish {
    return {
      messageId: message.properties.messageId as string,
      type: message.properties.type as string,
      timestamp: message.properties.timestamp as number,
      contentType: message.properties.contentType as string,
      persistent: true,
      headers: { ...message.properties.headers, ...headers },
    };
  }

  private payloadOf(message: ConsumeMessage): unknown {
    const content = message.content.toString();
    try {
      return JSON.parse(content) as unknown;
    } catch {
      return content;
    }
  }
}
