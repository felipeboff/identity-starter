import { OutboxKind } from "@shared/application/ports/outbox";
import { Access, UseCase } from "@shared/application/use-cases";

import { NotificationsOutboxEffect } from "../outbox/notifications-outbox-effect";

import {
  ScheduleEmailChangedNoticeDeps,
  ScheduleEmailChangedNoticeInput,
} from "./schedule-email-changed-notice.types";

export class ScheduleEmailChangedNoticeUseCase extends UseCase<{
  input: ScheduleEmailChangedNoticeInput;
  deps: ScheduleEmailChangedNoticeDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: ScheduleEmailChangedNoticeInput): Promise<void> {
    await this.deps.transactions.run(() =>
      this.deps.outbox.publish({
        kind: OutboxKind.EFFECT,
        type: NotificationsOutboxEffect.EMAIL_CHANGED_NOTICE,
        payload: {
          to: input.previousEmail,
          name: input.name,
          newEmail: input.newEmail,
        },
      }),
    );
  }
}
