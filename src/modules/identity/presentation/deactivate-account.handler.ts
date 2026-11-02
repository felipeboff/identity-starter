import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { DeactivateAccountUseCase } from "../application/use-cases/deactivate-account.use-case";

import { Actor } from "@/identity/application/actor";

const inputSchema = Type.Object({
  accountId: Type.String({ pattern: OBJECT_ID_PATTERN }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type DeactivateAccountHandlerDeps = {
  deactivateAccount: DeactivateAccountUseCase;
};

export class DeactivateAccountHandler extends Handler<{
  deps: DeactivateAccountHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
}> {
  readonly name = "identity.deactivate_account";
  readonly input = inputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<void> {
    await this.deps.deactivateAccount.execute(inbound.input, inbound.actor);
  }
}
