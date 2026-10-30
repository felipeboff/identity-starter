import type { RateLimiter } from "@shared/application/services/rate-limiter";
import { AppError } from "@shared/domain/errors/app-error";

import { RateLimitPolicy } from "../rate-limit.policy";

import { IdentityError } from "@/identity/domain/errors/identity.error";

const RULE = RateLimitPolicy.SIGN_IN_FAILURES_PER_EMAIL;

export type SignInThrottleDeps = Readonly<{
  rateLimiter: RateLimiter;
}>;

export class SignInThrottle {
  constructor(private readonly deps: SignInThrottleDeps) {}

  async ensureAllowed(email: string): Promise<void> {
    const decision = await this.deps.rateLimiter.check(RULE, email);
    if (decision.limited) {
      throw new AppError(IdentityError.SignInLocked, {
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }
  }

  async recordFailure(email: string): Promise<void> {
    await this.deps.rateLimiter.hit(RULE, email);
  }

  async reset(email: string): Promise<void> {
    await this.deps.rateLimiter.reset(RULE, email);
  }
}
