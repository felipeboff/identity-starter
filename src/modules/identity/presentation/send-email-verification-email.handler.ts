import { Handler, Inbound } from "@shared/presentation/handler";

import { TokenEmailInput, tokenEmailSchema } from "./token-email.schema";

import { SendEmailVerificationEmailUseCase } from "@/identity/application/use-cases/send-email-verification-email.use-case";

export type SendEmailVerificationEmailHandlerDeps = {
  sendEmailVerificationEmail: SendEmailVerificationEmailUseCase;
};

export class SendEmailVerificationEmailHandler extends Handler<{
  deps: SendEmailVerificationEmailHandlerDeps;
  input: typeof tokenEmailSchema;
}> {
  readonly name = "identity.send_email_verification_email";
  readonly input = tokenEmailSchema;

  async handle(inbound: Inbound<undefined, TokenEmailInput>): Promise<void> {
    await this.deps.sendEmailVerificationEmail.execute(inbound.input);
  }
}
