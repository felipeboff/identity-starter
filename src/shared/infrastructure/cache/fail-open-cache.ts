import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Cache } from "@shared/application/ports/cache";
import type { Logger } from "@shared/application/ports/logger";

type CacheOperation = "get" | "set" | "setIfNewer" | "delete";

export type FailOpenCacheDeps = Readonly<{
  cache: Cache;
  logger: Logger;
}>;

export class FailOpenCache {
  constructor(private readonly deps: FailOpenCacheDeps) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.deps.cache.get<T>(key);
    } catch (error) {
      this.failed("get", key, error);
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      await this.deps.cache.set(key, value, ttlMs);
    } catch (error) {
      this.failed("set", key, error);
    }
  }

  async setIfNewer(
    key: string,
    value: unknown,
    version: number,
    ttlMs: number,
  ): Promise<void> {
    try {
      await this.deps.cache.setIfNewer(key, value, version, ttlMs);
    } catch (error) {
      this.failed("setIfNewer", key, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.deps.cache.delete(key);
    } catch (error) {
      this.failed("delete", key, error);
    }
  }

  private failed(operation: CacheOperation, key: string, error: unknown): void {
    this.deps.logger.warn(SharedLogEvent.CacheCallFailed, {
      operation,
      key,
      error,
    });
  }
}
