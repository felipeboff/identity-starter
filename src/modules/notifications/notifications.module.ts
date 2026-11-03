import type { Logger } from "@shared/application/ports/logger";
import type { MailSender } from "@shared/application/ports/mail-sender";
import type { Outbox } from "@shared/application/ports/outbox";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { FetchHttpClient } from "@shared/infrastructure/http/fetch-http-client";
import type { MessageConsumer } from "@shared/presentation/messaging/message-consumer";
import type { OutboxConsumer } from "@shared/presentation/outbox/outbox-consumer";

import { ScheduleEmailChangedNoticeUseCase } from "./application/use-cases/schedule-email-changed-notice.use-case";
import { ScheduleWelcomeEmailUseCase } from "./application/use-cases/schedule-welcome-email.use-case";
import { SendEmailChangedNoticeUseCase } from "./application/use-cases/send-email-changed-notice.use-case";
import { SendWelcomeEmailUseCase } from "./application/use-cases/send-welcome-email.use-case";
import { ComposingNotificationsMailer } from "./infrastructure/composing-notifications-mailer";
import { EmailHtmlRenderer } from "./infrastructure/email-html-renderer";
import { LogMailSender } from "./infrastructure/log-mail-sender";
import {
  type MailFrom,
  MailerSendMailSender,
} from "./infrastructure/mailersend-mail-sender";
import { NotificationsEmailComposer } from "./infrastructure/notifications-email-composer";
import { createNotificationsMessageConsumers } from "./presentation/notifications.messaging";
import { createNotificationsOutboxConsumers } from "./presentation/notifications.outbox";

export type NotificationsMailerSettings = Readonly<{
  kind: "log" | "mailersend";
  apiKey: string;
  from: MailFrom;
}>;

export type NotificationsSettings = Readonly<{
  appUrl: URL;
  productName: string;
  externalCallTimeoutMs: number;
  mailer: NotificationsMailerSettings;
}>;

export type NotificationsRuntime = Readonly<{
  logger: Logger;
  outbox: Outbox;
  transactions: TransactionRunner;
}>;

export type NotificationsModule = Readonly<{
  mailSender: MailSender;
  messageConsumers: readonly MessageConsumer[];
  outboxConsumers: readonly OutboxConsumer[];
}>;

export const createNotificationsModule = (
  settings: NotificationsSettings,
  runtime: NotificationsRuntime,
): NotificationsModule => {
  const mailSender =
    settings.mailer.kind === "mailersend"
      ? new MailerSendMailSender({
          http: new FetchHttpClient({
            timeoutMs: settings.externalCallTimeoutMs,
            logger: runtime.logger,
          }),
          renderer: new EmailHtmlRenderer({
            productName: settings.productName,
          }),
          logger: runtime.logger,
          apiKey: settings.mailer.apiKey,
          from: settings.mailer.from,
        })
      : new LogMailSender({ logger: runtime.logger });
  const mailer = new ComposingNotificationsMailer({
    composer: new NotificationsEmailComposer({
      appUrl: settings.appUrl,
      productName: settings.productName,
    }),
    sender: mailSender,
  });
  const useCases = {
    scheduleWelcomeEmail: new ScheduleWelcomeEmailUseCase(runtime),
    scheduleEmailChangedNotice: new ScheduleEmailChangedNoticeUseCase(runtime),
    sendWelcomeEmail: new SendWelcomeEmailUseCase({ mailer }),
    sendEmailChangedNotice: new SendEmailChangedNoticeUseCase({ mailer }),
  };

  return {
    mailSender,
    messageConsumers: createNotificationsMessageConsumers(useCases),
    outboxConsumers: createNotificationsOutboxConsumers(useCases),
  };
};
