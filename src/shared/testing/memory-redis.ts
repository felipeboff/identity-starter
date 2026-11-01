import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, inject } from "vitest";

export const useMemoryRedis = () => {
  const database =
    Number(process.env.VITEST_POOL_ID) % inject("redisDatabases");
  const url = `${inject("redisUrl")}/${database}`;
  let admin: Redis | undefined;

  beforeAll(async () => {
    admin = new Redis(url);
    await admin.flushdb();
  });

  afterEach(async () => {
    await admin?.flushdb();
  });

  afterAll(async () => {
    await admin?.quit();
  });

  return { url: () => url };
};
