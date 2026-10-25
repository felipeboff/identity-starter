import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Logger } from "@shared/application/ports/logger";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { Redis } from "ioredis";

export type RedisConnectionOptions = Readonly<{
  url: string;
  logger: Logger;
  connectTimeoutMs?: number;
}>;

export class RedisConnection {
  readonly client: Redis;
  private connected = false;

  constructor(private readonly options: RedisConnectionOptions) {
    this.client = new Redis(options.url, {
      lazyConnect: true,
      connectTimeout: options.connectTimeoutMs ?? 10_000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) =>
        this.connected ? Math.min(attempt * 200, 2_000) : null,
    });
    // Errors surface through the failed commands, which their callers log.
    this.client.on("error", () => undefined);
  }

  async connect(): Promise<void> {
    const host = new URL(this.options.url).host;
    try {
      await this.client.connect();
    } catch (error) {
      this.options.logger.error(SharedLogEvent.CacheConnectionFailed, {
        host,
        error,
      });
      this.client.disconnect();
      throw new AppError(SharedError.CacheUnavailable);
    }
    this.connected = true;
    this.options.logger.info(SharedLogEvent.CacheConnected, { host });
  }

  async close(): Promise<void> {
    if (this.client.status === "ready") await this.client.quit();
    else this.client.disconnect();
  }
}
