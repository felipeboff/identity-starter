import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { DeactivateAccountInput } from "../application/use-cases/deactivate-account.types";
import { DeactivateAccountUseCase } from "../application/use-cases/deactivate-account.use-case";

import { Actor } from "@/identity/application/actor";

const inputSchema = v.object<DeactivateAccountInput>({
  accountId: v.objectId(),
});

export type DeactivateAccountHandlerDeps = {
  deactivateAccount: DeactivateAccountUseCase;
};

export class DeactivateAccountHandler extends Handler<{
  deps: DeactivateAccountHandlerDeps;
  actor: Actor;
  output: void;
}> {
  async handle(inbound: Inbound<Actor>): Promise<void> {
    const input = inputSchema.probe(inbound.input);
    await this.deps.deactivateAccount.execute(input, inbound.actor);
  }
}
