import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { SendWelcomeEmailUseCase } from "@/notifications/application/use-cases/send-welcome-email.use-case";

const inputSchema = Type.Object({
  to: Type.String({ format: "email" }),
  name: Type.String(),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type SendWelcomeEmailHandlerDeps = {
  sendWelcomeEmail: SendWelcomeEmailUseCase;
};

export class SendWelcomeEmailHandler extends Handler<{
  deps: SendWelcomeEmailHandlerDeps;
  input: typeof inputSchema;
}> {
  readonly name = "notifications.send_welcome_email";
  readonly input = inputSchema;

  async handle(inbound: Inbound<undefined, Input>): Promise<void> {
    await this.deps.sendWelcomeEmail.execute(inbound.input);
  }
}
