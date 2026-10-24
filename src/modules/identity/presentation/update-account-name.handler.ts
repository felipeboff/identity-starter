import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import {
  UpdateAccountNameInput,
  UpdateAccountNameOutput,
} from "@/identity/application/use-cases/update-account-name.types";
import { UpdateAccountNameUseCase } from "@/identity/application/use-cases/update-account-name.use-case";

const inputSchema = v.object<UpdateAccountNameInput>({
  name: v.string(),
});

export type UpdateAccountNameHandlerDeps = {
  updateAccountName: UpdateAccountNameUseCase;
};

export class UpdateAccountNameHandler extends Handler<{
  deps: UpdateAccountNameHandlerDeps;
  actor: Actor;
  output: UpdateAccountNameOutput;
}> {
  async handle(inbound: Inbound<Actor>): Promise<UpdateAccountNameOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.updateAccountName.execute(input, inbound.actor);
  }
}
