import { UseCase } from "@shared/application/use-cases";

import { RateLimitPolicy } from "../rate-limit.policy";
import { PASSWORD_RESET_TTL_MS } from "../token.policy";

import {
  RequestPasswordResetDeps,
  RequestPasswordResetInput,
} from "./request-password-reset.types";

import { PasswordReset } from "@/identity/domain/password-reset.entity";

/**
 * Sends a one-time reset token to the account's e-mail, with or without a password yet. Unknown
 * or deactivated e-mails finish silently so the endpoint does not reveal which addresses have an
 * account.
 */
export class RequestPasswordResetUseCase extends UseCase<{
  input: RequestPasswordResetInput;
  deps: RequestPasswordResetDeps;
}> {
  async execute(input: RequestPasswordResetInput): Promise<void> {
    const decision = await this.deps.rateLimiter.hit(
      RateLimitPolicy.PASSWORD_RESET_REQUEST_PER_EMAIL,
      input.email,
    );
    if (decision.limited) {
      return;
    }

    const issued = await this.deps.transactions.run(() => this.issue(input));
    if (!issued) {
      return;
    }

    await this.deps.mailer.sendPasswordReset(issued);
  }

  private async issue(input: RequestPasswordResetInput) {
    const account = await this.deps.accounts.findByEmail(input.email);
    if (!account || account.isDeleted()) {
      return null;
    }

    const at = this.deps.clock.now();

    const previous = await this.deps.passwordResets.listByAccountId(
      account.id.value,
    );
    for (const reset of previous.filter((reset) => reset.isPending(at))) {
      reset.markAsDeleted(at);
      await this.deps.passwordResets.save(reset);
    }

    const { token, tokenHash } = this.deps.tokens.issue();
    const expiresAt = new Date(at.getTime() + PASSWORD_RESET_TTL_MS);

    const passwordReset = PasswordReset.register(
      {
        id: this.deps.ids.next(),
        accountId: account.id.value,
        tokenHash,
        expiresAt,
      },
      at,
    );
    await this.deps.passwordResets.save(passwordReset);

    return {
      to: account.email.value,
      name: account.name,
      token,
      expiresAt,
    };
  }
}
