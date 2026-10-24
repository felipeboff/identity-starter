import { Clock } from "@shared/application/ports/clock";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
