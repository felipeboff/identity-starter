import { faker } from "@faker-js/faker";

import type { Clock } from "../application/ports/clock";

export class FakeClock implements Clock {
  constructor(private current = faker.date.recent()) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
