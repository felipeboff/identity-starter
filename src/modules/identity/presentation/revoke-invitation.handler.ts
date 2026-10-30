import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { RevokeInvitationInput } from "@/identity/application/use-cases/revoke-invitation.types";
import { RevokeInvitationUseCase } from "@/identity/application/use-cases/revoke-invitation.use-case";

const inputSchema = v.object<RevokeInvitationInput>({
  invitationId: v.objectId(),
});

export type RevokeInvitationHandlerDeps = {
  revokeInvitation: RevokeInvitationUseCase;
};

export class RevokeInvitationHandler extends Handler<{
  deps: RevokeInvitationHandlerDeps;
  actor: Actor;
  output: void;
}> {
  async handle(inbound: Inbound<Actor>): Promise<void> {
    const input = inputSchema.probe(inbound.input);
    await this.deps.revokeInvitation.execute(input, inbound.actor);
  }
}
