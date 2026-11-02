import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { RevokeOtherSessionsOutput } from "@/identity/application/use-cases/revoke-other-sessions.types";
import { RevokeOtherSessionsUseCase } from "@/identity/application/use-cases/revoke-other-sessions.use-case";

const outputSchema = Type.Object({
  revokedCount: Type.Integer({ minimum: 0 }),
});

export type RevokeOtherSessionsHandlerDeps = {
  revokeOtherSessions: RevokeOtherSessionsUseCase;
};

export class RevokeOtherSessionsHandler extends Handler<{
  deps: RevokeOtherSessionsHandlerDeps;
  actor: Actor;
  output: typeof outputSchema;
}> {
  readonly name = "identity.revoke_other_sessions";
  readonly output = outputSchema;

  async handle(inbound: Inbound<Actor>): Promise<RevokeOtherSessionsOutput> {
    return this.deps.revokeOtherSessions.execute(inbound.actor);
  }
}
