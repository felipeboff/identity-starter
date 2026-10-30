import { SharedLogEvent } from "../logging/shared.log-event";
import type { Cache } from "../ports/cache";
import type { Logger } from "../ports/logger";

export type RateLimitRule = Readonly<{
  name: string;
  limit: number;
  windowMs: number;
}>;

export type RateLimitDecision =
  | Readonly<{ limited: false }>
  | Readonly<{ limited: true; retryAfterSeconds: number }>;

export type RateLimiterDeps = Readonly<{
  cache: Cache;
  logger: Logger;
}>;

const ALLOWED: RateLimitDecision = { limited: false };

export class RateLimiter {
  constructor(private readonly deps: RateLimiterDeps) {}

  async hit(rule: RateLimitRule, key: string): Promise<RateLimitDecision> {
    try {
      const hits = await this.deps.cache.increment(
        this.keyOf(rule, key),
        rule.windowMs,
      );
      return hits > rule.limit ? await this.limited(rule, key) : ALLOWED;
    } catch (error) {
      return this.unavailable(rule, error);
    }
  }

  async check(rule: RateLimitRule, key: string): Promise<RateLimitDecision> {
    try {
      const hits =
        (await this.deps.cache.get<number>(this.keyOf(rule, key))) ?? 0;
      return hits >= rule.limit ? await this.limited(rule, key) : ALLOWED;
    } catch (error) {
      return this.unavailable(rule, error);
    }
  }

  async reset(rule: RateLimitRule, key: string): Promise<void> {
    try {
      await this.deps.cache.delete(this.keyOf(rule, key));
    } catch (error) {
      this.unavailable(rule, error);
    }
  }

  private async limited(
    rule: RateLimitRule,
    key: string,
  ): Promise<RateLimitDecision> {
    const ttlMs = (await this.deps.cache.ttl(this.keyOf(rule, key))) ?? 0;
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
    };
  }

  private unavailable(rule: RateLimitRule, error: unknown): RateLimitDecision {
    this.deps.logger.warn(SharedLogEvent.RateLimiterUnavailable, {
      rule: rule.name,
      error,
    });
    return ALLOWED;
  }

  private keyOf(rule: RateLimitRule, key: string): string {
    return `rate:${rule.name}:${key}`;
  }
}
