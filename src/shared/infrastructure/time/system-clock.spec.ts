import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SystemClock } from "./system-clock";

describe("SystemClock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current system time", () => {
    const now = faker.date.anytime();
    vi.useFakeTimers({ now });

    expect(new SystemClock().now()).toStrictEqual(now);
  });

  it("returns a new date on every call", () => {
    const clock = new SystemClock();

    expect(clock.now()).not.toBe(clock.now());
  });
});
