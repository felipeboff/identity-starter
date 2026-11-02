import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { accountOutputSchema } from "./output.schema";

import { ConfirmEmailChangeOutput } from "@/identity/application/use-cases/confirm-email-change.types";
import { ConfirmEmailChangeUseCase } from "@/identity/application/use-cases/confirm-email-change.use-case";

const inputSchema = Type.Object({
  token: Type.String({ minLength: 1 }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object({ account: accountOutputSchema });

export type ConfirmEmailChangeHandlerDeps = {
  confirmEmailChange: ConfirmEmailChangeUseCase;
};

export class ConfirmEmailChangeHandler extends Handler<{
  deps: ConfirmEmailChangeHandlerDeps;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.confirm_email_change";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(
    inbound: Inbound<undefined, Input>,
  ): Promise<ConfirmEmailChangeOutput> {
    return this.deps.confirmEmailChange.execute(inbound.input);
  }
}
