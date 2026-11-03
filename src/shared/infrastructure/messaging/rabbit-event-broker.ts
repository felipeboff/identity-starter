import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Clock } from "@shared/application/ports/clock";
import type {
  EventBroker,
  PublishedEvent,
} from "@shared/application/ports/event-broker";
import type { Logger } from "@shared/application/ports/logger";
import type { ChannelWrapper } from "amqp-connection-manager";
import type { ConfirmChannel } from "amqplib";

import type { RabbitConnection } from "./rabbit-connection";
import { RabbitTopology } from "./rabbit-topology";

const CHANNEL = "events";

export type RabbitEventBrokerDeps = Readonly<{
  connection: RabbitConnection;
  prefix: string;
  clock: Clock;
  logger: Logger;
  publishTimeoutMs?: number;
}>;

export class RabbitEventBroker implements EventBroker {
  private readonly topology: RabbitTopology;
  private readonly channel: ChannelWrapper;

  constructor(private readonly deps: RabbitEventBrokerDeps) {
    this.topology = new RabbitTopology(deps.prefix);
    this.channel = deps.connection.manager.createChannel({
      name: CHANNEL,
      confirm: true,
      publishTimeout: deps.publishTimeoutMs ?? 10_000,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(this.topology.exchange, "topic", {
          durable: true,
        });
      },
    });
    this.channel.on("error", (error) => {
      deps.logger.error(SharedLogEvent.BrokerChannelFailed, {
        channel: CHANNEL,
        error,
      });
    });
  }

  ready(): Promise<void> {
    return this.channel.waitForConnect();
  }

  async send(event: PublishedEvent): Promise<void> {
    await this.channel.publish(
      this.topology.exchange,
      event.type,
      Buffer.from(JSON.stringify(event.payload)),
      {
        messageId: event.id,
        type: event.type,
        timestamp: Math.floor(this.deps.clock.now().getTime() / 1_000),
        contentType: "application/json",
        persistent: true,
      },
    );
  }

  close(): Promise<void> {
    return this.channel.close();
  }
}
