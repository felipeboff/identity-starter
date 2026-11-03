import type { Logger } from "@shared/application/ports/logger";
import type {
  MailSender,
  OutgoingEmail,
} from "@shared/application/ports/mail-sender";

import { NotificationsLogEvent } from "./notifications.log-event";

export type LogMailSenderDeps = Readonly<{
  logger: Logger;
}>;

export class LogMailSender implements MailSender {
  constructor(private readonly deps: LogMailSenderDeps) {}

  send(email: OutgoingEmail): Promise<void> {
    this.deps.logger.info(NotificationsLogEvent.EmailLogged, {
      template: email.template,
      to: email.to,
      link: email.link,
      expiresAt: email.expiresAt?.toISOString() ?? null,
    });
    return Promise.resolve();
  }
}
