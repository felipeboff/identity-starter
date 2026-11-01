import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { ListCredentialsOutput } from "@/identity/application/use-cases/list-credentials.types";
import { ListCredentialsUseCase } from "@/identity/application/use-cases/list-credentials.use-case";

export type ListCredentialsHandlerDeps = {
  listCredentials: ListCredentialsUseCase;
};

export class ListCredentialsHandler extends Handler<{
  deps: ListCredentialsHandlerDeps;
  actor: Actor;
  output: ListCredentialsOutput;
}> {
  readonly name = "identity.list_credentials";

  async handle(inbound: Inbound<Actor>): Promise<ListCredentialsOutput> {
    return this.deps.listCredentials.execute(inbound.actor);
  }
}
