import { Handler, Inbound } from "@shared/presentation/handler";

import { TokenEmailInput, tokenEmailSchema } from "./token-email.schema";

import { SendPasswordResetEmailUseCase } from "@/identity/application/use-cases/send-password-reset-email.use-case";

export type SendPasswordResetEmailHandlerDeps = {
  sendPasswordResetEmail: SendPasswordResetEmailUseCase;
};

export class SendPasswordResetEmailHandler extends Handler<{
  deps: SendPasswordResetEmailHandlerDeps;
  input: typeof tokenEmailSchema;
}> {
  readonly name = "identity.send_password_reset_email";
  readonly input = tokenEmailSchema;

  async handle(inbound: Inbound<undefined, TokenEmailInput>): Promise<void> {
    await this.deps.sendPasswordResetEmail.execute(inbound.input);
  }
}
