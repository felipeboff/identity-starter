import { Access, UseCase } from "@shared/application/use-cases";

import { IdentityOutboxEffect } from "../outbox/identity-outbox-effect";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import {
  SendPasswordResetEmailDeps,
  SendPasswordResetEmailInput,
} from "./send-password-reset-email.types";

export class SendPasswordResetEmailUseCase extends UseCase<{
  input: SendPasswordResetEmailInput;
  deps: SendPasswordResetEmailDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: SendPasswordResetEmailInput): Promise<void> {
    if (this.deps.clock.now() >= input.expiresAt) {
      this.deps.logger.info(
        IdentityUseCaseLogEvent.EmailExpiredBeforeDelivery,
        {
          type: IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
        },
      );
      return;
    }

    await this.deps.mailer.sendPasswordReset(input);
  }
}
