import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import { FakeLogger } from "../../testing/fake-logger";
import { InMemoryCache } from "../../testing/in-memory-cache";
import { SharedLogEvent } from "../logging/shared.log-event";
import { LogLevel } from "../ports/logger";

import { type RateLimitRule, RateLimiter } from "./rate-limiter";

const buildRule = (): RateLimitRule => ({
  name: faker.lorem.slug(),
  limit: faker.number.int({ min: 2, max: 10 }),
  windowMs: faker.number.int({ min: 1_500, max: 60_000 }),
});

const create = () => {
  let now = faker.date.recent().getTime();
  const clock = { now: () => new Date(now) };
  const cache = new InMemoryCache(clock);
  const logger = new FakeLogger();
  const advance = (ms: number) => {
    now += ms;
  };
  return {
    limiter: new RateLimiter({ cache, logger }),
    cache,
    logger,
    advance,
  };
};

describe("RateLimiter", () => {
  it("allows hits up to the limit", async () => {
    const { limiter } = create();
    const rule = buildRule();
    const key = faker.internet.ip();

    const decisions = [];
    for (let i = 0; i < rule.limit; i++)
      decisions.push(await limiter.hit(rule, key));

    expect(decisions).toStrictEqual(
      Array<unknown>(rule.limit).fill({ limited: false }),
    );
  });

  it("limits the hit past the limit with the seconds left in the window", async () => {
    const { limiter, advance } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    const elapsed = faker.number.int({ min: 1, max: rule.windowMs - 1 });
    for (let i = 0; i < rule.limit; i++) await limiter.hit(rule, key);
    advance(elapsed);

    expect(await limiter.hit(rule, key)).toStrictEqual({
      limited: true,
      retryAfterSeconds: Math.ceil((rule.windowMs - elapsed) / 1000),
    });
  });

  it("never asks to retry in less than a second", async () => {
    const { limiter, cache } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    for (let i = 0; i < rule.limit; i++) await limiter.hit(rule, key);
    vi.spyOn(cache, "ttl").mockResolvedValue(undefined);

    expect(await limiter.hit(rule, key)).toStrictEqual({
      limited: true,
      retryAfterSeconds: 1,
    });
  });

  it("allows again once the window is over", async () => {
    const { limiter, advance } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    for (let i = 0; i < rule.limit + 1; i++) await limiter.hit(rule, key);

    advance(rule.windowMs);

    expect(await limiter.hit(rule, key)).toStrictEqual({ limited: false });
  });

  it("checks without counting a hit", async () => {
    const { limiter } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    for (let i = 0; i < rule.limit - 1; i++) await limiter.hit(rule, key);

    await limiter.check(rule, key);

    expect(await limiter.check(rule, key)).toStrictEqual({ limited: false });
  });

  it("checks as limited once the hits reach the limit", async () => {
    const { limiter } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    for (let i = 0; i < rule.limit; i++) await limiter.hit(rule, key);

    expect(await limiter.check(rule, key)).toStrictEqual({
      limited: true,
      retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
    });
  });

  it("checks as allowed a key never hit", async () => {
    const { limiter } = create();

    expect(await limiter.check(buildRule(), faker.internet.ip())).toStrictEqual(
      { limited: false },
    );
  });

  it("keeps rules and keys apart", async () => {
    const { limiter } = create();
    const rule = buildRule();
    const other = { ...rule, name: `${rule.name}-other` };
    const key = faker.internet.ip();
    for (let i = 0; i < rule.limit; i++) await limiter.hit(rule, key);

    expect(await limiter.check(other, key)).toStrictEqual({ limited: false });
    expect(await limiter.check(rule, `${key}0`)).toStrictEqual({
      limited: false,
    });
  });

  it("forgets the hits of a key when reset", async () => {
    const { limiter } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    for (let i = 0; i < rule.limit; i++) await limiter.hit(rule, key);

    await limiter.reset(rule, key);

    expect(await limiter.check(rule, key)).toStrictEqual({ limited: false });
  });

  it("allows everything and logs while the cache is unavailable", async () => {
    const { limiter, cache, logger } = create();
    const rule = buildRule();
    const key = faker.internet.ip();
    const error = new Error(faker.lorem.sentence());
    vi.spyOn(cache, "increment").mockRejectedValue(error);
    vi.spyOn(cache, "get").mockRejectedValue(error);
    vi.spyOn(cache, "delete").mockRejectedValue(error);

    const decisions = [
      await limiter.hit(rule, key),
      await limiter.check(rule, key),
    ];
    await limiter.reset(rule, key);

    expect(decisions).toStrictEqual([{ limited: false }, { limited: false }]);
    expect(logger.entries).toStrictEqual(
      Array<unknown>(3).fill({
        level: LogLevel.WARN,
        event: SharedLogEvent.RateLimiterUnavailable.name,
        fields: { rule: rule.name, error },
      }),
    );
  });
});
