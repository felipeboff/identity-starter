import { Logger } from "@shared/application/ports/logger";
import { AppError } from "@shared/domain/errors/app-error";
import { FetchHttpClient } from "@shared/infrastructure/http/fetch-http-client";

import {
  EmailChangedNotice,
  IdentityMailer,
  InvitationEmail,
  TokenEmail,
} from "../application/ports/identity-mailer";

import {
  IdentityEmail,
  IdentityEmailComposer,
} from "./identity-email-composer";
import { IdentityLogEvent } from "./identity.log-event";

import { IdentityError } from "@/identity/domain/errors/identity.error";

export const MAILERSEND_EMAIL_URL = "https://api.mailersend.com/v1/email";

const ACCEPTED = 202;

export type MailSender = Readonly<{ email: string; name: string }>;

export type MailerSendIdentityMailerDeps = Readonly<{
  http: FetchHttpClient;
  composer: IdentityEmailComposer;
  logger: Logger;
  apiKey: string;
  from: MailSender;
}>;

export class MailerSendIdentityMailer implements IdentityMailer {
  constructor(private readonly deps: MailerSendIdentityMailerDeps) {}

  sendPasswordReset(email: TokenEmail): Promise<void> {
    return this.send(this.deps.composer.passwordReset(email));
  }

  sendInvitation(email: InvitationEmail): Promise<void> {
    return this.send(this.deps.composer.invitation(email));
  }

  sendEmailChange(email: TokenEmail): Promise<void> {
    return this.send(this.deps.composer.emailChange(email));
  }

  sendEmailChanged(notice: EmailChangedNotice): Promise<void> {
    return this.send(this.deps.composer.emailChanged(notice));
  }

  sendEmailVerification(email: TokenEmail): Promise<void> {
    return this.send(this.deps.composer.emailVerification(email));
  }

  private async send(email: IdentityEmail): Promise<void> {
    const result = await this.deps.http.send({
      method: "POST",
      url: MAILERSEND_EMAIL_URL,
      headers: { authorization: `Bearer ${this.deps.apiKey}` },
      body: {
        json: {
          from: this.deps.from,
          to: [{ email: email.to, name: email.name }],
          subject: email.subject,
          text: email.text,
        },
      },
    });

    if (result.ok && result.status === ACCEPTED) return;

    this.deps.logger.error(
      IdentityLogEvent.EmailDeliveryFailed,
      result.ok
        ? {
            template: email.template,
            failure: "unexpected_status",
            status: result.status,
          }
        : { template: email.template, failure: result.failure },
    );
    throw new AppError(IdentityError.EmailDeliveryFailed);
  }
}
