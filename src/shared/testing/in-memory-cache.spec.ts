import { faker } from "@faker-js/faker";
import { describe } from "vitest";

import { cacheContract } from "./contracts/cache.contract";
import { InMemoryCache } from "./in-memory-cache";

describe("InMemoryCache", () => {
  cacheContract(() => {
    let now = faker.date.recent().getTime();
    const clock = { now: () => new Date(now) };
    return {
      cache: new InMemoryCache(clock),
      elapse: (ms) => {
        now += ms;
        return Promise.resolve();
      },
    };
  });
});
