import type { OutboxConsumer } from "@shared/presentation/outbox/outbox-consumer";

import {
  SendEmailChangedNoticeHandler,
  type SendEmailChangedNoticeHandlerDeps,
} from "./send-email-changed-notice.handler";
import {
  SendWelcomeEmailHandler,
  type SendWelcomeEmailHandlerDeps,
} from "./send-welcome-email.handler";

import { NotificationsOutboxEffect } from "@/notifications/application/outbox/notifications-outbox-effect";

export type NotificationsOutboxDeps = SendWelcomeEmailHandlerDeps &
  SendEmailChangedNoticeHandlerDeps;

export const createNotificationsOutboxConsumers = (
  deps: NotificationsOutboxDeps,
): readonly OutboxConsumer[] => [
  {
    type: NotificationsOutboxEffect.WELCOME_EMAIL,
    handler: new SendWelcomeEmailHandler(deps),
  },
  {
    type: NotificationsOutboxEffect.EMAIL_CHANGED_NOTICE,
    handler: new SendEmailChangedNoticeHandler(deps),
  },
];
