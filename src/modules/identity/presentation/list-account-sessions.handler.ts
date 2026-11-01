import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { ListAccountSessionsOutput } from "@/identity/application/use-cases/list-account-sessions.types";
import { ListAccountSessionsUseCase } from "@/identity/application/use-cases/list-account-sessions.use-case";

const inputSchema = Type.Object({
  accountId: Type.String({ pattern: OBJECT_ID_PATTERN }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type ListAccountSessionsHandlerDeps = {
  listAccountSessions: ListAccountSessionsUseCase;
};

export class ListAccountSessionsHandler extends Handler<{
  deps: ListAccountSessionsHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: ListAccountSessionsOutput;
}> {
  readonly name = "identity.list_account_sessions";
  readonly input = inputSchema;

  async handle(
    inbound: Inbound<Actor, Input>,
  ): Promise<ListAccountSessionsOutput> {
    return this.deps.listAccountSessions.execute(inbound.input, inbound.actor);
  }
}
