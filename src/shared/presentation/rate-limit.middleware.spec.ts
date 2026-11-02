import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import { RateLimiter } from "../application/services/rate-limiter";
import { SharedError } from "../domain/errors/shared.error";
import { expectAppError } from "../testing/expect-app-error";
import { FakeLogger } from "../testing/fake-logger";
import { InMemoryCache } from "../testing/in-memory-cache";

import type { Inbound } from "./handler";
import { RateLimitMiddleware } from "./rate-limit.middleware";

const buildInbound = (ip = faker.internet.ip()): Inbound<unknown> => ({
  input: {},
  metadata: {},
  ip,
  actor: undefined,
});

const create = () => {
  const clock = { now: () => new Date() };
  const limiter = new RateLimiter({
    cache: new InMemoryCache(clock),
    logger: new FakeLogger(),
  });
  const rule = {
    name: faker.lorem.slug(),
    limit: faker.number.int({ min: 1, max: 5 }),
    windowMs: faker.number.int({ min: 1_500, max: 60_000 }),
  };
  return { middleware: new RateLimitMiddleware({ limiter, rule }), rule };
};

describe("RateLimitMiddleware", () => {
  it("lets requests through up to the limit", async () => {
    const { middleware, rule } = create();
    const inbound = buildInbound();
    const output = faker.lorem.word();
    const next = vi.fn(() => Promise.resolve(output));

    const results = [];
    for (let i = 0; i < rule.limit; i++) {
      results.push(await middleware.handle(inbound, next));
    }

    expect(results).toStrictEqual(Array<string>(rule.limit).fill(output));
    expect(next).toHaveBeenCalledWith(inbound);
  });

  it("refuses the request past the limit with the seconds left in the window", async () => {
    const { middleware, rule } = create();
    const inbound = buildInbound();
    const next = vi.fn(() => Promise.resolve());
    for (let i = 0; i < rule.limit; i++) await middleware.handle(inbound, next);

    await expectAppError(
      middleware.handle(inbound, next),
      SharedError.RateLimited,
      { retryAfterSeconds: Math.ceil(rule.windowMs / 1000) },
    );
    expect(next).toHaveBeenCalledTimes(rule.limit);
  });

  it("counts each IP on its own", async () => {
    const { middleware, rule } = create();
    const next = vi.fn(() => Promise.resolve());
    const first = buildInbound();
    for (let i = 0; i < rule.limit; i++) await middleware.handle(first, next);

    await middleware.handle(buildInbound(), next);

    expect(next).toHaveBeenCalledTimes(rule.limit + 1);
  });
});
