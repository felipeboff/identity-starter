import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { ScheduleEmailChangedNoticeUseCase } from "@/notifications/application/use-cases/schedule-email-changed-notice.use-case";

const inputSchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  previousEmail: Type.String({ format: "email" }),
  newEmail: Type.String({ format: "email" }),
  name: Type.String(),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type ScheduleEmailChangedNoticeHandlerDeps = {
  scheduleEmailChangedNotice: ScheduleEmailChangedNoticeUseCase;
};

export class ScheduleEmailChangedNoticeHandler extends Handler<{
  deps: ScheduleEmailChangedNoticeHandlerDeps;
  input: typeof inputSchema;
}> {
  readonly name = "notifications.schedule_email_changed_notice";
  readonly input = inputSchema;

  async handle(inbound: Inbound<undefined, Input>): Promise<void> {
    await this.deps.scheduleEmailChangedNotice.execute({
      previousEmail: inbound.input.previousEmail,
      newEmail: inbound.input.newEmail,
      name: inbound.input.name,
    });
  }
}
