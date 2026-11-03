import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toOutputInvitation } from "../mappers/toOutputInvitation";

import {
  ListInvitationsDeps,
  ListInvitationsOutput,
} from "./list-invitations.types";

import { IdentityPermission } from "@/identity/domain/identity.permission";

export class ListInvitationsUseCase extends UseCase<{
  output: ListInvitationsOutput;
  deps: ListInvitationsDeps;
  actor: Actor;
}> {
  readonly access = { permissions: [IdentityPermission.INVITATION_READ] };

  async execute(_actor: Actor): Promise<ListInvitationsOutput> {
    const at = this.deps.clock.now();
    const invitations = await this.deps.invitations.list();

    return {
      invitations: invitations
        .filter((invitation) => invitation.isPending(at))
        .reverse()
        .map(toOutputInvitation),
    };
  }
}
