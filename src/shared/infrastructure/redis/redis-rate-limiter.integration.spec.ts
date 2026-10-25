import { setTimeout as sleep } from "node:timers/promises";

import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RedisConnection } from "./redis-connection";
import { RedisRateLimiter } from "./redis-rate-limiter";

const buildRule = (
  windowMs = faker.number.int({ min: 10_000, max: 60_000 }),
) => ({
  name: faker.string.alpha({ length: 12, casing: "lower" }),
  limit: faker.number.int({ min: 2, max: 10 }),
  windowMs,
});

describe("RedisRateLimiter", () => {
  const redis = useMemoryRedis();
  let connection: RedisConnection;
  let logger: FakeLogger;
  let limiter: RedisRateLimiter;

  beforeAll(async () => {
    logger = new FakeLogger();
    connection = new RedisConnection({ url: redis.url(), logger });
    await connection.connect();
    limiter = new RedisRateLimiter({ client: connection.client, logger });
  });

  afterAll(async () => {
    await connection.close();
  });

  it("counts hits in a window that expires with the rule", async () => {
    const rule = buildRule();
    const key = faker.internet.ip();

    await limiter.increment(rule, key);
    const second = await limiter.increment(rule, key);

    expect(second.count).toBe(2);
    expect(second.resetInMs).toBeGreaterThan(0);
    expect(second.resetInMs).toBeLessThanOrEqual(rule.windowMs);
  });

  it("reads the current count without adding to it", async () => {
    const rule = buildRule();
    const key = faker.internet.ip();
    await limiter.increment(rule, key);

    const first = await limiter.read(rule, key);
    const again = await limiter.read(rule, key);

    expect(first.count).toBe(1);
    expect(again.count).toBe(1);
    expect(first.resetInMs).toBeGreaterThan(0);
  });

  it("reads zero for a key never seen", async () => {
    expect(await limiter.read(buildRule(), faker.internet.ip())).toStrictEqual({
      count: 0,
      resetInMs: 0,
    });
  });

  it("starts over once the window is over", async () => {
    const rule = buildRule(50);
    const key = faker.internet.ip();
    await limiter.increment(rule, key);

    await sleep(120);

    expect((await limiter.increment(rule, key)).count).toBe(1);
  });

  it("forgets a key when cleared", async () => {
    const rule = buildRule();
    const key = faker.internet.ip();
    await limiter.increment(rule, key);

    await limiter.clear(rule, key);

    expect((await limiter.read(rule, key)).count).toBe(0);
  });

  it("lets everything through and logs when Redis is unavailable", async () => {
    const down = new RedisConnection({ url: redis.url(), logger });
    const downLogger = new FakeLogger();
    const blind = new RedisRateLimiter({
      client: down.client,
      logger: downLogger,
    });
    const rule = buildRule();
    const key = faker.internet.ip();

    const counts = [
      await blind.increment(rule, key),
      await blind.read(rule, key),
    ];
    await blind.clear(rule, key);

    expect(counts).toStrictEqual([
      { count: 0, resetInMs: 0 },
      { count: 0, resetInMs: 0 },
    ]);
    expect(downLogger.entries).toHaveLength(3);
    expect(downLogger.entries[0]).toMatchObject({
      level: LogLevel.WARN,
      event: SharedLogEvent.RateLimiterUnavailable.name,
      fields: { rule: rule.name },
    });
  });
});
