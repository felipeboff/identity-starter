import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { SendEmailChangedNoticeUseCase } from "@/notifications/application/use-cases/send-email-changed-notice.use-case";

const inputSchema = Type.Object({
  to: Type.String({ format: "email" }),
  name: Type.String(),
  newEmail: Type.String({ format: "email" }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type SendEmailChangedNoticeHandlerDeps = {
  sendEmailChangedNotice: SendEmailChangedNoticeUseCase;
};

export class SendEmailChangedNoticeHandler extends Handler<{
  deps: SendEmailChangedNoticeHandlerDeps;
  input: typeof inputSchema;
}> {
  readonly name = "notifications.send_email_changed_notice";
  readonly input = inputSchema;

  async handle(inbound: Inbound<undefined, Input>): Promise<void> {
    await this.deps.sendEmailChangedNotice.execute(inbound.input);
  }
}
