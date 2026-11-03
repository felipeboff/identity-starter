import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { AccountRegisteredVia } from "@/identity/public";
import { ScheduleWelcomeEmailUseCase } from "@/notifications/application/use-cases/schedule-welcome-email.use-case";

const inputSchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  email: Type.String({ format: "email" }),
  name: Type.String(),
  registeredVia: Type.Enum(Object.values(AccountRegisteredVia)),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type ScheduleWelcomeEmailHandlerDeps = {
  scheduleWelcomeEmail: ScheduleWelcomeEmailUseCase;
};

export class ScheduleWelcomeEmailHandler extends Handler<{
  deps: ScheduleWelcomeEmailHandlerDeps;
  input: typeof inputSchema;
}> {
  readonly name = "notifications.schedule_welcome_email";
  readonly input = inputSchema;

  async handle(inbound: Inbound<undefined, Input>): Promise<void> {
    await this.deps.scheduleWelcomeEmail.execute({
      email: inbound.input.email,
      name: inbound.input.name,
    });
  }
}
