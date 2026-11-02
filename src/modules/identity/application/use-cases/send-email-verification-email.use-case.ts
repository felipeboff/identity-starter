import { Access, UseCase } from "@shared/application/use-cases";

import { IdentityOutboxEffect } from "../outbox/identity-outbox-effect";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import {
  SendEmailVerificationEmailDeps,
  SendEmailVerificationEmailInput,
} from "./send-email-verification-email.types";

export class SendEmailVerificationEmailUseCase extends UseCase<{
  input: SendEmailVerificationEmailInput;
  deps: SendEmailVerificationEmailDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: SendEmailVerificationEmailInput): Promise<void> {
    if (this.deps.clock.now() >= input.expiresAt) {
      this.deps.logger.info(
        IdentityUseCaseLogEvent.EmailExpiredBeforeDelivery,
        {
          type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
        },
      );
      return;
    }

    await this.deps.mailer.sendEmailVerification(input);
  }
}
