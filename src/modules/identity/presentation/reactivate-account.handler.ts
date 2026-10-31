import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { ReactivateAccountOutput } from "@/identity/application/use-cases/reactivate-account.types";
import { ReactivateAccountUseCase } from "@/identity/application/use-cases/reactivate-account.use-case";

const inputSchema = Type.Object({
  accountId: Type.String({ pattern: OBJECT_ID_PATTERN }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type ReactivateAccountHandlerDeps = {
  reactivateAccount: ReactivateAccountUseCase;
};

export class ReactivateAccountHandler extends Handler<{
  deps: ReactivateAccountHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: ReactivateAccountOutput;
}> {
  readonly name = "identity.reactivate_account";
  readonly input = inputSchema;

  async handle(
    inbound: Inbound<Actor, Input>,
  ): Promise<ReactivateAccountOutput> {
    return this.deps.reactivateAccount.execute(inbound.input, inbound.actor);
  }
}
