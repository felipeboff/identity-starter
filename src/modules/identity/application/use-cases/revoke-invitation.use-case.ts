import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import {
  RevokeInvitationDeps,
  RevokeInvitationInput,
} from "./revoke-invitation.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";

export class RevokeInvitationUseCase extends UseCase<{
  input: RevokeInvitationInput;
  deps: RevokeInvitationDeps;
  actor: Actor;
}> {
  async execute(input: RevokeInvitationInput, actor: Actor): Promise<void> {
    this.deps.accessPolicy.ensureCanInvite(actor);

    const invitation = await this.deps.invitations.findById(input.invitationId);
    if (!invitation) {
      throw new AppError(IdentityError.InvitationNotFound, {
        invitationId: input.invitationId,
      });
    }

    invitation.revoke(this.deps.clock.now());
    await this.deps.invitations.save(invitation);
  }
}
