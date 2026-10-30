import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toPublicInvitation } from "../mappers/toPublicInvitation";

import {
  ListInvitationsDeps,
  ListInvitationsOutput,
} from "./list-invitations.types";

export class ListInvitationsUseCase extends UseCase<{
  output: ListInvitationsOutput;
  deps: ListInvitationsDeps;
  actor: Actor;
}> {
  async execute(actor: Actor): Promise<ListInvitationsOutput> {
    this.deps.accessPolicy.ensureCanInvite(actor);

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
