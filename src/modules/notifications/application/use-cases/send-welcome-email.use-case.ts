import { Access, UseCase } from "@shared/application/use-cases";

import {
  SendWelcomeEmailDeps,
  SendWelcomeEmailInput,
} from "./send-welcome-email.types";

export class SendWelcomeEmailUseCase extends UseCase<{
  input: SendWelcomeEmailInput;
  deps: SendWelcomeEmailDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: SendWelcomeEmailInput): Promise<void> {
    await this.deps.mailer.sendWelcome(input);
  }
}
