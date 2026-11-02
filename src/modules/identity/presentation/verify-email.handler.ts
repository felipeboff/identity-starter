import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { accountOutputSchema } from "./output.schema";

import { VerifyEmailOutput } from "@/identity/application/use-cases/verify-email.types";
import { VerifyEmailUseCase } from "@/identity/application/use-cases/verify-email.use-case";

const inputSchema = Type.Object({
  token: Type.String(),
});

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object({ account: accountOutputSchema });

export type VerifyEmailHandlerDeps = {
  verifyEmail: VerifyEmailUseCase;
};

export class VerifyEmailHandler extends Handler<{
  deps: VerifyEmailHandlerDeps;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.verify_email";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(inbound: Inbound<undefined, Input>): Promise<VerifyEmailOutput> {
    return this.deps.verifyEmail.execute(inbound.input);
  }
}
