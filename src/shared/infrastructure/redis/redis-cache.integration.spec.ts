import { setTimeout as sleep } from "node:timers/promises";

import { faker } from "@faker-js/faker";
import { cacheContract } from "@shared/testing/contracts/cache.contract";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RedisCache } from "./redis-cache";
import { RedisConnection } from "./redis-connection";

describe("RedisCache", () => {
  const redis = useMemoryRedis();
  let connection: RedisConnection;

  beforeAll(async () => {
    connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    await connection.connect();
  });

  afterAll(async () => {
    await connection.close();
  });

  cacheContract(() => ({
    cache: new RedisCache({ client: connection.client }),
    elapse: (ms) => sleep(ms + 50),
  }));

  it("rejects every call while Redis is unavailable", async () => {
    const down = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    const cache = new RedisCache({ client: down.client });
    const key = faker.string.alphanumeric(16);
    const ttlMs = faker.number.int({ min: 10_000, max: 60_000 });

    const calls = await Promise.allSettled([
      cache.get(key),
      cache.set(key, faker.lorem.word(), ttlMs),
      cache.setIfNewer(key, faker.lorem.word(), 1, ttlMs),
      cache.increment(key, ttlMs),
      cache.delete(key),
      cache.ttl(key),
    ]);

    expect(calls.map((call) => call.status)).toStrictEqual(
      Array<string>(6).fill("rejected"),
    );
  });
});
