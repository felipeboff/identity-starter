import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { UpdateAccountNameOutput } from "@/identity/application/use-cases/update-account-name.types";
import { UpdateAccountNameUseCase } from "@/identity/application/use-cases/update-account-name.use-case";

const inputSchema = Type.Object({
  name: Type.String(),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type UpdateAccountNameHandlerDeps = {
  updateAccountName: UpdateAccountNameUseCase;
};

export class UpdateAccountNameHandler extends Handler<{
  deps: UpdateAccountNameHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: UpdateAccountNameOutput;
}> {
  readonly name = "identity.update_account_name";
  readonly input = inputSchema;

  async handle(
    inbound: Inbound<Actor, Input>,
  ): Promise<UpdateAccountNameOutput> {
    return this.deps.updateAccountName.execute(inbound.input, inbound.actor);
  }
}
