import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { listedSessionOutputSchema } from "./output.schema";

import { Actor } from "@/identity/application/actor";
import { ListSessionsOutput } from "@/identity/application/use-cases/list-sessions.types";
import { ListSessionsUseCase } from "@/identity/application/use-cases/list-sessions.use-case";

const outputSchema = Type.Object({
  sessions: Type.Array(listedSessionOutputSchema),
});

export type ListSessionsHandlerDeps = {
  listSessions: ListSessionsUseCase;
};

export class ListSessionsHandler extends Handler<{
  deps: ListSessionsHandlerDeps;
  actor: Actor;
  output: typeof outputSchema;
}> {
  readonly name = "identity.list_sessions";
  readonly output = outputSchema;

  async handle(inbound: Inbound<Actor>): Promise<ListSessionsOutput> {
    return this.deps.listSessions.execute(inbound.actor);
  }
}
