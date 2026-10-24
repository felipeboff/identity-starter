import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import {
  VerifyEmailInput,
  VerifyEmailOutput,
} from "@/identity/application/use-cases/verify-email.types";
import { VerifyEmailUseCase } from "@/identity/application/use-cases/verify-email.use-case";

const inputSchema = v.object<VerifyEmailInput>({
  token: v.string(),
});

export type VerifyEmailHandlerDeps = {
  verifyEmail: VerifyEmailUseCase;
};

export class VerifyEmailHandler extends Handler<{
  deps: VerifyEmailHandlerDeps;
  output: VerifyEmailOutput;
}> {
  async handle(inbound: Inbound): Promise<VerifyEmailOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.verifyEmail.execute(input);
  }
}
