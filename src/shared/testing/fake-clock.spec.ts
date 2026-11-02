import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { FakeClock } from "./fake-clock";

const DAY_MS = 24 * 60 * 60 * 1_000;

describe("FakeClock", () => {
  it("starts within the last day when no instant is given", () => {
    const before = Date.now();

    const clock = new FakeClock();

    expect(clock.now().getTime()).toBeGreaterThanOrEqual(before - DAY_MS);
    expect(clock.now().getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("returns copies of its instant", () => {
    const start = faker.date.recent();
    const clock = new FakeClock(start);

    clock.now().setFullYear(2000);

    expect(clock.now()).toEqual(start);
  });

  it("starts at the given instant and advances", () => {
    const start = faker.date.recent();
    const clock = new FakeClock(start);

    clock.advance(1_000);

    expect(clock.now()).toEqual(new Date(start.getTime() + 1_000));
  });
});
