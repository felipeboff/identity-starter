import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { RevokeOtherSessionsOutput } from "@/identity/application/use-cases/revoke-other-sessions.types";
import { RevokeOtherSessionsUseCase } from "@/identity/application/use-cases/revoke-other-sessions.use-case";

export type RevokeOtherSessionsHandlerDeps = {
  revokeOtherSessions: RevokeOtherSessionsUseCase;
};

export class RevokeOtherSessionsHandler extends Handler<{
  deps: RevokeOtherSessionsHandlerDeps;
  actor: Actor;
  output: RevokeOtherSessionsOutput;
}> {
  readonly name = "identity.revoke_other_sessions";

  async handle(inbound: Inbound<Actor>): Promise<RevokeOtherSessionsOutput> {
    return this.deps.revokeOtherSessions.execute(inbound.actor);
  }
}
