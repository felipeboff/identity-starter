import { Logger } from "@shared/application/ports/logger";

import {
  IdentityMailer,
  TokenEmail,
} from "../application/ports/identity-mailer";

import {
  IdentityEmail,
  IdentityEmailComposer,
} from "./identity-email-composer";
import { IdentityLogEvent } from "./identity.log-event";

export type LogIdentityMailerDeps = Readonly<{
  composer: IdentityEmailComposer;
  logger: Logger;
}>;

export class LogIdentityMailer implements IdentityMailer {
  constructor(private readonly deps: LogIdentityMailerDeps) {}

  sendPasswordReset(email: TokenEmail): Promise<void> {
    this.log(this.deps.composer.passwordReset(email));
    return Promise.resolve();
  }

  sendEmailVerification(email: TokenEmail): Promise<void> {
    this.log(this.deps.composer.emailVerification(email));
    return Promise.resolve();
  }

  private log(email: IdentityEmail): void {
    this.deps.logger.info(IdentityLogEvent.EmailLogged, {
      template: email.template,
      to: email.to,
      link: email.link,
      expiresAt: email.expiresAt.toISOString(),
    });
  }
}
