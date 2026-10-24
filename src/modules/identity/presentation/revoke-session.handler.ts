import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { RevokeSessionInput } from "@/identity/application/use-cases/revoke-session.types";
import { RevokeSessionUseCase } from "@/identity/application/use-cases/revoke-session.use-case";

const inputSchema = v.object<RevokeSessionInput>({
  sessionId: v.objectId(),
});

export type RevokeSessionHandlerDeps = {
  revokeSession: RevokeSessionUseCase;
};

export class RevokeSessionHandler extends Handler<{
  deps: RevokeSessionHandlerDeps;
  actor: Actor;
  output: void;
}> {
  async handle(inbound: Inbound<Actor>): Promise<void> {
    const input = inputSchema.probe(inbound.input);
    await this.deps.revokeSession.execute(input, inbound.actor);
  }
}
