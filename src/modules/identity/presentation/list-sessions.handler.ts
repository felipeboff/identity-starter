import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { ListSessionsOutput } from "@/identity/application/use-cases/list-sessions.types";
import { ListSessionsUseCase } from "@/identity/application/use-cases/list-sessions.use-case";

export type ListSessionsHandlerDeps = {
  listSessions: ListSessionsUseCase;
};

export class ListSessionsHandler extends Handler<{
  deps: ListSessionsHandlerDeps;
  actor: Actor;
  output: ListSessionsOutput;
}> {
  readonly name = "identity.list_sessions";

  async handle(inbound: Inbound<Actor>): Promise<ListSessionsOutput> {
    return this.deps.listSessions.execute(inbound.actor);
  }
}
