import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import {
  ReactivateAccountInput,
  ReactivateAccountOutput,
} from "@/identity/application/use-cases/reactivate-account.types";
import { ReactivateAccountUseCase } from "@/identity/application/use-cases/reactivate-account.use-case";

const inputSchema = v.object<ReactivateAccountInput>({
  accountId: v.objectId(),
});

export type ReactivateAccountHandlerDeps = {
  reactivateAccount: ReactivateAccountUseCase;
};

export class ReactivateAccountHandler extends Handler<{
  deps: ReactivateAccountHandlerDeps;
  actor: Actor;
  output: ReactivateAccountOutput;
}> {
  async handle(inbound: Inbound<Actor>): Promise<ReactivateAccountOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.reactivateAccount.execute(input, inbound.actor);
  }
}
