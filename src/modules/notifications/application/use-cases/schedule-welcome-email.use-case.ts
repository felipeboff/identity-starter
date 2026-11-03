import { OutboxKind } from "@shared/application/ports/outbox";
import { Access, UseCase } from "@shared/application/use-cases";

import { NotificationsOutboxEffect } from "../outbox/notifications-outbox-effect";

import {
  ScheduleWelcomeEmailDeps,
  ScheduleWelcomeEmailInput,
} from "./schedule-welcome-email.types";

export class ScheduleWelcomeEmailUseCase extends UseCase<{
  input: ScheduleWelcomeEmailInput;
  deps: ScheduleWelcomeEmailDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: ScheduleWelcomeEmailInput): Promise<void> {
    await this.deps.transactions.run(() =>
      this.deps.outbox.publish({
        kind: OutboxKind.EFFECT,
        type: NotificationsOutboxEffect.WELCOME_EMAIL,
        payload: { to: input.email, name: input.name },
      }),
    );
  }
}
