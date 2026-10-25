import { faker } from "@faker-js/faker";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { useMemoryRedis } from "./memory-redis";

describe("useMemoryRedis", () => {
  const redis = useMemoryRedis();
  const key = faker.string.alpha(12);
  let client: Redis;

  beforeAll(() => {
    client = new Redis(redis.url());
  });

  afterAll(async () => {
    await client.quit();
  });

  it("serves a real Redis at the given URL", async () => {
    await client.set(key, faker.lorem.word());

    expect(await client.ping()).toBe("PONG");
  });

  it("starts every test with an empty Redis", async () => {
    expect(await client.exists(key)).toBe(0);
  });
});
