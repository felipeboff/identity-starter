import type { RateLimiter } from "@shared/application/ports/rate-limiter";
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
    const failures = await this.deps.rateLimiter.read(RULE, email);
    if (failures.count >= RULE.limit) {
      throw new AppError(IdentityError.SignInLocked, {
        retryAfterSeconds: Math.max(1, Math.ceil(failures.resetInMs / 1000)),
      });
    }
  }

  async recordFailure(email: string): Promise<void> {
    await this.deps.rateLimiter.increment(RULE, email);
  }

  async reset(email: string): Promise<void> {
    await this.deps.rateLimiter.clear(RULE, email);
  }
}
