import { Redis } from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { afterAll, afterEach, beforeAll } from "vitest";

export const useMemoryRedis = () => {
  let server: RedisMemoryServer | undefined;
  let admin: Redis | undefined;
  let url = "";

  beforeAll(async () => {
    server = await RedisMemoryServer.create();
    url = `redis://${await server.getHost()}:${await server.getPort()}`;
    admin = new Redis(url);
  });

  afterEach(async () => {
    await admin?.flushall();
  });

  afterAll(async () => {
    await admin?.quit();
    await server?.stop();
  });

  return { url: () => url };
};
