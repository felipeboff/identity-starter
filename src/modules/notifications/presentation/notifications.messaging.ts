import type { MessageConsumer } from "@shared/presentation/messaging/message-consumer";

import {
  ScheduleEmailChangedNoticeHandler,
  type ScheduleEmailChangedNoticeHandlerDeps,
} from "./schedule-email-changed-notice.handler";
import {
  ScheduleWelcomeEmailHandler,
  type ScheduleWelcomeEmailHandlerDeps,
} from "./schedule-welcome-email.handler";

import { IdentityEvent } from "@/identity/public";

export type NotificationsMessagingDeps = ScheduleWelcomeEmailHandlerDeps &
  ScheduleEmailChangedNoticeHandlerDeps;

export const createNotificationsMessageConsumers = (
  deps: NotificationsMessagingDeps,
): readonly MessageConsumer[] => [
  {
    event: IdentityEvent.ACCOUNT_REGISTERED,
    handler: new ScheduleWelcomeEmailHandler(deps),
  },
  {
    event: IdentityEvent.EMAIL_CHANGED,
    handler: new ScheduleEmailChangedNoticeHandler(deps),
  },
];
