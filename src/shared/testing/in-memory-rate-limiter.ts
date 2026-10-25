import type { Clock } from "../application/ports/clock";
import type {
  RateLimitCount,
  RateLimitRule,
  RateLimiter,
} from "../application/ports/rate-limiter";

type RateWindow = { count: number; resetAt: number };

export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, RateWindow>();

  constructor(private readonly clock: Clock) {}

  increment(rule: RateLimitRule, key: string): Promise<RateLimitCount> {
    const now = this.clock.now().getTime();
    const window = this.activeWindow(rule, key, now) ?? {
      count: 0,
      resetAt: now + rule.windowMs,
    };
    window.count += 1;
    this.windows.set(this.idOf(rule, key), window);
    return Promise.resolve(this.countOf(window, now));
  }

  read(rule: RateLimitRule, key: string): Promise<RateLimitCount> {
    const now = this.clock.now().getTime();
    const window = this.activeWindow(rule, key, now);
    return Promise.resolve(
      window ? this.countOf(window, now) : { count: 0, resetInMs: 0 },
    );
  }

  clear(rule: RateLimitRule, key: string): Promise<void> {
    this.windows.delete(this.idOf(rule, key));
    return Promise.resolve();
  }

  private activeWindow(
    rule: RateLimitRule,
    key: string,
    now: number,
  ): RateWindow | undefined {
    const window = this.windows.get(this.idOf(rule, key));
    return window && window.resetAt > now ? window : undefined;
  }

  private countOf(window: RateWindow, now: number): RateLimitCount {
    return { count: window.count, resetInMs: window.resetAt - now };
  }

  private idOf(rule: RateLimitRule, key: string): string {
    return `${rule.name}:${key}`;
  }
}
