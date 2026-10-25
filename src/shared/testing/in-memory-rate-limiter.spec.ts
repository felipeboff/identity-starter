import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "./in-memory-rate-limiter";

const buildRule = () => ({
  name: faker.lorem.slug(),
  limit: faker.number.int({ min: 2, max: 10 }),
  windowMs: faker.number.int({ min: 1_000, max: 60_000 }),
});

const create = () => {
  let now = faker.date.recent().getTime();
  const clock = { now: () => new Date(now) };
  const advance = (ms: number) => {
    now += ms;
  };
  return { limiter: new InMemoryRateLimiter(clock), advance };
};

describe("InMemoryRateLimiter", () => {
  it("counts hits in a window that starts at the first hit", async () => {
    const { limiter } = create();
    const rule = buildRule();
    const key = faker.internet.ip();

    await limiter.increment(rule, key);
    const second = await limiter.increment(rule, key);

    expect(second).toStrictEqual({ count: 2, resetInMs: rule.windowMs });
  });

  it("tells how long is left in the window", async () => {
    const { limiter, advance } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    const elapsed = faker.number.int({ min: 1, max: rule.windowMs - 1 });

    await limiter.increment(rule, key);
    advance(elapsed);

    expect(await limiter.read(rule, key)).toStrictEqual({
      count: 1,
      resetInMs: rule.windowMs - elapsed,
    });
  });

  it("starts over once the window is over", async () => {
    const { limiter, advance } = create();
    const rule = buildRule();
    const key = faker.internet.ip();

    await limiter.increment(rule, key);
    advance(rule.windowMs);

    expect(await limiter.read(rule, key)).toStrictEqual({
      count: 0,
      resetInMs: 0,
    });
    expect(await limiter.increment(rule, key)).toStrictEqual({
      count: 1,
      resetInMs: rule.windowMs,
    });
  });

  it("keeps rules and keys apart", async () => {
    const { limiter } = create();
    const rule = buildRule();
    const other = { ...buildRule(), name: `${rule.name}-other` };
    const key = faker.internet.ip();

    await limiter.increment(rule, key);

    expect((await limiter.read(other, key)).count).toBe(0);
    expect((await limiter.read(rule, `${key}-other`)).count).toBe(0);
  });

  it("forgets a key when cleared", async () => {
    const { limiter } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    await limiter.increment(rule, key);

    await limiter.clear(rule, key);

    expect((await limiter.read(rule, key)).count).toBe(0);
  });
});
