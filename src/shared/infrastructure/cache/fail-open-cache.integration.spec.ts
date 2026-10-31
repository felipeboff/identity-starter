import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RedisCache } from "../redis/redis-cache";
import { RedisConnection } from "../redis/redis-connection";

import { FailOpenCache } from "./fail-open-cache";

const buildKey = () => faker.string.alphanumeric(16);

const longTtl = () => faker.number.int({ min: 10_000, max: 60_000 });

const buildValue = () => ({
  name: faker.person.fullName(),
  count: faker.number.int({ min: 1, max: 1_000 }),
});

describe("FailOpenCache", () => {
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

  const create = (client = connection.client) => {
    const logger = new FakeLogger();
    const cache = new FailOpenCache({
      cache: new RedisCache({ client }),
      logger,
    });
    return { cache, logger };
  };

  it("reads back what was set", async () => {
    const { cache, logger } = create();
    const key = buildKey();
    const value = buildValue();

    await cache.set(key, value, longTtl());

    expect(await cache.get(key)).toStrictEqual(value);
    expect(logger.entries).toStrictEqual([]);
  });

  it("forgets an entry when deleted", async () => {
    const { cache } = create();
    const key = buildKey();
    await cache.set(key, buildValue(), longTtl());

    await cache.delete(key);

    expect(await cache.get(key)).toBeUndefined();
  });

  it("misses and logs every call while Redis is unavailable", async () => {
    const down = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    const { cache, logger } = create(down.client);
    const key = buildKey();

    await cache.set(key, buildValue(), longTtl());
    const cached = await cache.get(key);
    await cache.delete(key);

    expect(cached).toBeUndefined();
    expect(logger.entries).toStrictEqual(
      ["set", "get", "delete"].map((operation) => ({
        level: LogLevel.WARN,
        event: SharedLogEvent.CacheCallFailed.name,
        fields: { operation, key, error: expect.any(Error) as unknown },
      })),
    );
  });
});
