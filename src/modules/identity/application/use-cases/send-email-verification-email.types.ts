import { Clock } from "@shared/application/ports/clock";
import type { Logger } from "@shared/application/ports/logger";

import { IdentityMailer, TokenEmail } from "../ports/identity-mailer";

export type SendEmailVerificationEmailInput = TokenEmail;

export type SendEmailVerificationEmailDeps = {
  mailer: IdentityMailer;

  clock: Clock;
  logger: Logger;
};
