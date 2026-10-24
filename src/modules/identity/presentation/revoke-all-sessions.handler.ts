import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import {
  RevokeAllSessionsInput,
  RevokeAllSessionsOutput,
} from "@/identity/application/use-cases/revoke-all-sessions.types";
import { RevokeAllSessionsUseCase } from "@/identity/application/use-cases/revoke-all-sessions.use-case";

const inputSchema = v.object<RevokeAllSessionsInput>({
  accountId: v.objectId(),
});

export type RevokeAllSessionsHandlerDeps = {
  revokeAllSessions: RevokeAllSessionsUseCase;
};

export class RevokeAllSessionsHandler extends Handler<{
  deps: RevokeAllSessionsHandlerDeps;
  actor: Actor;
  output: RevokeAllSessionsOutput;
}> {
  async handle(inbound: Inbound<Actor>): Promise<RevokeAllSessionsOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.revokeAllSessions.execute(input, inbound.actor);
  }
}
