import type {
  RateLimitRule,
  RateLimiter,
} from "../application/services/rate-limiter";
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
    const decision = await this.deps.limiter.hit(this.deps.rule, inbound.ip);
    if (decision.limited) {
      throw new AppError(SharedError.RateLimited, {
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }
    return next(inbound);
  }
}
