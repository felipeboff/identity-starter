import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Logger } from "@shared/application/ports/logger";
import type {
  RateLimitCount,
  RateLimitRule,
  RateLimiter,
} from "@shared/application/ports/rate-limiter";
import type { Redis } from "ioredis";

const INCREMENT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
return { count, redis.call("PTTL", KEYS[1]) }
`;

const NOTHING_COUNTED: RateLimitCount = { count: 0, resetInMs: 0 };

export type RedisRateLimiterDeps = Readonly<{
  client: Redis;
  logger: Logger;
}>;

export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly deps: RedisRateLimiterDeps) {}

  async increment(rule: RateLimitRule, key: string): Promise<RateLimitCount> {
    try {
      const [count, ttl] = (await this.deps.client.eval(
        INCREMENT,
        1,
        this.keyOf(rule, key),
        rule.windowMs,
      )) as [number, number];
      return { count, resetInMs: Math.max(ttl, 0) };
    } catch (error) {
      return this.unavailable(rule, error);
    }
  }

  async read(rule: RateLimitRule, key: string): Promise<RateLimitCount> {
    try {
      const [count, ttl] = await Promise.all([
        this.deps.client.get(this.keyOf(rule, key)),
        this.deps.client.pttl(this.keyOf(rule, key)),
      ]);
      return { count: Number(count ?? 0), resetInMs: Math.max(ttl, 0) };
    } catch (error) {
      return this.unavailable(rule, error);
    }
  }

  async clear(rule: RateLimitRule, key: string): Promise<void> {
    try {
      await this.deps.client.del(this.keyOf(rule, key));
    } catch (error) {
      this.unavailable(rule, error);
    }
  }

  private unavailable(rule: RateLimitRule, error: unknown): RateLimitCount {
    this.deps.logger.warn(SharedLogEvent.RateLimiterUnavailable, {
      rule: rule.name,
      error,
    });
    return NOTHING_COUNTED;
  }

  private keyOf(rule: RateLimitRule, key: string): string {
    return `rate:${rule.name}:${key}`;
  }
}
