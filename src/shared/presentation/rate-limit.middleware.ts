import type {
  RateLimitRule,
  RateLimiter,
} from "../application/ports/rate-limiter";
import { AppError } from "../domain/errors/app-error";
import { SharedError } from "../domain/errors/shared.error";

import { type Inbound, Middleware, type Next } from "./handler";

export type RateLimitMiddlewareDeps = Readonly<{
  limiter: RateLimiter;
  rule: RateLimitRule;
}>;

export class RateLimitMiddleware extends Middleware<{
  deps: RateLimitMiddlewareDeps;
  actor: unknown;
}> {
  async handle(
    inbound: Inbound<unknown>,
    next: Next<unknown>,
  ): Promise<unknown> {
    const hit = await this.deps.limiter.increment(this.deps.rule, inbound.ip);
    if (hit.count > this.deps.rule.limit) {
      throw new AppError(SharedError.RateLimited, {
        retryAfterSeconds: Math.max(1, Math.ceil(hit.resetInMs / 1000)),
      });
    }
    return next(inbound);
  }
}
