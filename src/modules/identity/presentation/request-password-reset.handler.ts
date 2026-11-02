import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { RequestPasswordResetUseCase } from "@/identity/application/use-cases/request-password-reset.use-case";

const inputSchema = Type.Object({
  email: Type.String({ format: "email" }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type RequestPasswordResetHandlerDeps = {
  requestPasswordReset: RequestPasswordResetUseCase;
};

export class RequestPasswordResetHandler extends Handler<{
  deps: RequestPasswordResetHandlerDeps;
  input: typeof inputSchema;
}> {
  readonly name = "identity.request_password_reset";
  readonly input = inputSchema;

  async handle(inbound: Inbound<undefined, Input>): Promise<void> {
    await this.deps.requestPasswordReset.execute(inbound.input);
  }
}
