import { OutboxConsumer } from "@shared/presentation/outbox/outbox-consumer";

import { SendEmailVerificationEmailHandler } from "./send-email-verification-email.handler";
import { SendPasswordResetEmailHandler } from "./send-password-reset-email.handler";

import { IdentityOutboxEffect } from "@/identity/application/outbox/identity-outbox-effect";
import { SendEmailVerificationEmailUseCase } from "@/identity/application/use-cases/send-email-verification-email.use-case";
import { SendPasswordResetEmailUseCase } from "@/identity/application/use-cases/send-password-reset-email.use-case";

export type IdentityOutboxDeps = {
  sendPasswordResetEmail: SendPasswordResetEmailUseCase;
  sendEmailVerificationEmail: SendEmailVerificationEmailUseCase;
};

export const createIdentityOutboxConsumers = (
  deps: IdentityOutboxDeps,
): readonly OutboxConsumer[] => [
  {
    type: IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
    handler: new SendPasswordResetEmailHandler(deps),
  },
  {
    type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
    handler: new SendEmailVerificationEmailHandler(deps),
  },
];
