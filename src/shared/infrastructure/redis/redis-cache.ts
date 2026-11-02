import type { Cache } from "@shared/application/ports/cache";
import type { Redis } from "ioredis";

const INCREMENT = `
local value = redis.call("INCR", KEYS[1])
if redis.call("PTTL", KEYS[1]) < 0 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
return value
`;

const SET_IF_NEWER = `
local stored = redis.call("GET", KEYS[2])
if stored and tonumber(stored) >= tonumber(ARGV[2]) then return 0 end
redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[3])
redis.call("SET", KEYS[2], ARGV[2], "PX", ARGV[3])
return 1
`;

export type RedisCacheDeps = Readonly<{
  client: Redis;
}>;

export class RedisCache implements Cache {
  constructor(private readonly deps: RedisCacheDeps) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.deps.client.get(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.deps.client.set(key, JSON.stringify(value), "PX", ttlMs);
  }

  async setIfNewer(
    key: string,
    value: unknown,
    version: number,
    ttlMs: number,
  ): Promise<void> {
    await this.deps.client.eval(
      SET_IF_NEWER,
      2,
      key,
      `${key}:version`,
      JSON.stringify(value),
      version,
      ttlMs,
    );
  }

  async delete(key: string): Promise<void> {
    await this.deps.client.del(key);
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    return (await this.deps.client.eval(INCREMENT, 1, key, ttlMs)) as number;
  }

  async ttl(key: string): Promise<number | undefined> {
    const ttlMs = await this.deps.client.pttl(key);
    return ttlMs < 0 ? undefined : ttlMs;
  }
}
