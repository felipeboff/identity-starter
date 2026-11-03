import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Logger } from "@shared/application/ports/logger";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import {
  type AmqpConnectionManager,
  AmqpConnectionManagerClass,
} from "amqp-connection-manager";

export type RabbitConnectionOptions = Readonly<{
  url: string;
  logger: Logger;
  connectTimeoutMs?: number;
  reconnectMs?: number;
}>;

export class RabbitConnection {
  readonly manager: AmqpConnectionManager;
  private readonly host: string;

  constructor(private readonly options: RabbitConnectionOptions) {
    this.host = new URL(options.url).host;
    this.manager = new AmqpConnectionManagerClass([options.url], {
      reconnectTimeInSeconds: (options.reconnectMs ?? 2_000) / 1_000,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.manager.connect({
        timeout: this.options.connectTimeoutMs ?? 10_000,
      });
    } catch (error) {
      this.options.logger.error(SharedLogEvent.BrokerConnectionFailed, {
        host: this.host,
        error,
      });
      // Closing waits for a reconnect that the close itself cancels; it never resolves.
      void this.manager.close();
      throw new AppError(SharedError.BrokerUnavailable);
    }
    this.options.logger.info(SharedLogEvent.BrokerConnected, {
      host: this.host,
    });
    this.manager.on("connect", () => {
      this.options.logger.info(SharedLogEvent.BrokerConnected, {
        host: this.host,
      });
    });
    this.manager.on("disconnect", (event) => {
      this.options.logger.warn(SharedLogEvent.BrokerDisconnected, {
        host: this.host,
        error: event.err,
      });
    });
  }

  close(): Promise<void> {
    return this.manager.close();
  }
}
