import type { Logger } from "@shared/application/ports/logger";
import type {
  MailSender,
  OutgoingEmail,
} from "@shared/application/ports/mail-sender";
import { AppError } from "@shared/domain/errors/app-error";
import type { FetchHttpClient } from "@shared/infrastructure/http/fetch-http-client";

import type { EmailHtmlRenderer } from "./email-html-renderer";
import { NotificationsLogEvent } from "./notifications.log-event";

import { NotificationsError } from "@/notifications/domain/errors/notifications.error";

export const MAILERSEND_EMAIL_URL = "https://api.mailersend.com/v1/email";

const ACCEPTED = 202;

export type MailFrom = Readonly<{ email: string; name: string }>;

export type MailerSendMailSenderDeps = Readonly<{
  http: FetchHttpClient;
  renderer: EmailHtmlRenderer;
  logger: Logger;
  apiKey: string;
  from: MailFrom;
}>;

export class MailerSendMailSender implements MailSender {
  constructor(private readonly deps: MailerSendMailSenderDeps) {}

  async send(email: OutgoingEmail): Promise<void> {
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
          html: this.deps.renderer.render(email),
        },
      },
    });

    if (result.ok && result.status === ACCEPTED) return;

    this.deps.logger.error(
      NotificationsLogEvent.EmailDeliveryFailed,
      result.ok
        ? {
            template: email.template,
            failure: "unexpected_status",
            status: result.status,
          }
        : { template: email.template, failure: result.failure },
    );
    throw new AppError(NotificationsError.EmailDeliveryFailed);
  }
}
