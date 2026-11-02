import { Clock } from "@shared/application/ports/clock";
import type { Logger } from "@shared/application/ports/logger";

import { IdentityMailer, TokenEmail } from "../ports/identity-mailer";

export type SendPasswordResetEmailInput = TokenEmail;

export type SendPasswordResetEmailDeps = {
  mailer: IdentityMailer;

  clock: Clock;
  logger: Logger;
};
