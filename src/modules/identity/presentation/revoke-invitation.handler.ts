import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { RevokeInvitationUseCase } from "@/identity/application/use-cases/revoke-invitation.use-case";

const inputSchema = Type.Object({
  invitationId: Type.String({ pattern: OBJECT_ID_PATTERN }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type RevokeInvitationHandlerDeps = {
  revokeInvitation: RevokeInvitationUseCase;
};

export class RevokeInvitationHandler extends Handler<{
  deps: RevokeInvitationHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
}> {
  readonly name = "identity.revoke_invitation";
  readonly input = inputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<void> {
    await this.deps.revokeInvitation.execute(inbound.input, inbound.actor);
  }
}
