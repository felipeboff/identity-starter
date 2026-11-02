import { faker } from "@faker-js/faker";
import { beforeEach, expect, it } from "vitest";

import type { Cache } from "../../application/ports/cache";

export type CacheUnderContract = Readonly<{
  cache: Cache;
  elapse(ms: number): Promise<void>;
}>;

const buildKey = () => faker.string.alphanumeric(16);

const longTtl = () => faker.number.int({ min: 10_000, max: 60_000 });

const shortTtl = () => faker.number.int({ min: 20, max: 50 });

const buildValue = () => ({
  name: faker.person.fullName(),
  count: faker.number.int({ min: 1, max: 1_000 }),
  tags: faker.helpers.multiple(() => faker.lorem.word(), { count: 3 }),
});

export const cacheContract = (create: () => CacheUnderContract) => {
  let cache: Cache;
  let elapse: CacheUnderContract["elapse"];

  beforeEach(() => {
    ({ cache, elapse } = create());
  });

  it("reads back what was set", async () => {
    const key = buildKey();
    const value = buildValue();

    await cache.set(key, value, longTtl());

    expect(await cache.get(key)).toStrictEqual(value);
  });

  it("keeps a copy as JSON, not the value it was given", async () => {
    const key = buildKey();
    const value = buildValue();
    const tags = [...value.tags];
    const at = faker.date.recent();
    await cache.set(key, { ...value, at }, longTtl());

    value.tags.push(faker.lorem.word());

    expect(await cache.get(key)).toStrictEqual({
      ...value,
      tags,
      at: at.toISOString(),
    });
  });

  it("misses a key never set", async () => {
    const key = buildKey();

    expect(await cache.get(key)).toBeUndefined();
    expect(await cache.ttl(key)).toBeUndefined();
  });

  it("replaces the value of a key set again", async () => {
    const key = buildKey();
    const value = buildValue();
    await cache.set(key, buildValue(), longTtl());

    await cache.set(key, value, longTtl());

    expect(await cache.get(key)).toStrictEqual(value);
  });

  it("tells how long an entry has left", async () => {
    const key = buildKey();
    const ttlMs = longTtl();

    await cache.set(key, buildValue(), ttlMs);
    const left = await cache.ttl(key);

    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(ttlMs);
  });

  it("forgets an entry once its time is over", async () => {
    const key = buildKey();
    const ttlMs = shortTtl();
    await cache.set(key, buildValue(), ttlMs);

    await elapse(ttlMs);

    expect(await cache.get(key)).toBeUndefined();
    expect(await cache.ttl(key)).toBeUndefined();
  });

  it("forgets an entry when deleted", async () => {
    const key = buildKey();
    await cache.set(key, buildValue(), longTtl());

    await cache.delete(key);

    expect(await cache.get(key)).toBeUndefined();
  });

  it("counts up from one", async () => {
    const key = buildKey();

    await cache.increment(key, longTtl());

    expect(await cache.increment(key, longTtl())).toBe(2);
  });

  it("keeps the expiry set by the first increment", async () => {
    const key = buildKey();
    const ttlMs = shortTtl();
    await cache.increment(key, ttlMs);

    await cache.increment(key, longTtl());

    expect(await cache.ttl(key)).toBeLessThanOrEqual(ttlMs);
  });

  it("starts a new counter once the old one is over", async () => {
    const key = buildKey();
    const ttlMs = shortTtl();
    await cache.increment(key, ttlMs);

    await elapse(ttlMs);

    expect(await cache.increment(key, longTtl())).toBe(1);
  });

  it("reads a counter as a number", async () => {
    const key = buildKey();

    await cache.increment(key, longTtl());

    expect(await cache.get<number>(key)).toBe(1);
  });

  it("keeps keys apart", async () => {
    const key = buildKey();
    const value = buildValue();
    await cache.set(key, value, longTtl());

    const other = await cache.increment(buildKey(), longTtl());

    expect(other).toBe(1);
    expect(await cache.get(key)).toStrictEqual(value);
  });
};
