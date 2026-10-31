import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { RevokeAllSessionsOutput } from "@/identity/application/use-cases/revoke-all-sessions.types";
import { RevokeAllSessionsUseCase } from "@/identity/application/use-cases/revoke-all-sessions.use-case";

const inputSchema = Type.Object({
  accountId: Type.String({ pattern: OBJECT_ID_PATTERN }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type RevokeAllSessionsHandlerDeps = {
  revokeAllSessions: RevokeAllSessionsUseCase;
};

export class RevokeAllSessionsHandler extends Handler<{
  deps: RevokeAllSessionsHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: RevokeAllSessionsOutput;
}> {
  readonly name = "identity.revoke_all_sessions";
  readonly input = inputSchema;

  async handle(
    inbound: Inbound<Actor, Input>,
  ): Promise<RevokeAllSessionsOutput> {
    return this.deps.revokeAllSessions.execute(inbound.input, inbound.actor);
  }
}
