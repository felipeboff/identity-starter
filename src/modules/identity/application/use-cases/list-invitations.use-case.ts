import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toPublicInvitation } from "../mappers/toPublicInvitation";

import {
  ListInvitationsDeps,
  ListInvitationsOutput,
} from "./list-invitations.types";

import { MembershipPermission } from "@/identity/domain/membership.entity";

export class ListInvitationsUseCase extends UseCase<{
  output: ListInvitationsOutput;
  deps: ListInvitationsDeps;
  actor: Actor;
}> {
  readonly permissions = [MembershipPermission.INVITATION_READ];

  async execute(_actor: Actor): Promise<ListInvitationsOutput> {
    const at = this.deps.clock.now();
    const invitations = await this.deps.invitations.list();

    return {
      invitations: invitations
        .filter((invitation) => invitation.isPending(at))
        .reverse()
        .map(toPublicInvitation),
    };
  }
}
