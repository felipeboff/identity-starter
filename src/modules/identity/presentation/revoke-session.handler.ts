import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { RevokeSessionUseCase } from "@/identity/application/use-cases/revoke-session.use-case";

const inputSchema = Type.Object({
  sessionId: Type.String({ pattern: OBJECT_ID_PATTERN }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type RevokeSessionHandlerDeps = {
  revokeSession: RevokeSessionUseCase;
};

export class RevokeSessionHandler extends Handler<{
  deps: RevokeSessionHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: void;
}> {
  readonly name = "identity.revoke_session";
  readonly input = inputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<void> {
    await this.deps.revokeSession.execute(inbound.input, inbound.actor);
  }
}
