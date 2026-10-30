import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { ListInvitationsOutput } from "@/identity/application/use-cases/list-invitations.types";
import { ListInvitationsUseCase } from "@/identity/application/use-cases/list-invitations.use-case";

export type ListInvitationsHandlerDeps = {
  listInvitations: ListInvitationsUseCase;
};

export class ListInvitationsHandler extends Handler<{
  deps: ListInvitationsHandlerDeps;
  actor: Actor;
  output: ListInvitationsOutput;
}> {
  async handle(inbound: Inbound<Actor>): Promise<ListInvitationsOutput> {
    return this.deps.listInvitations.execute(inbound.actor);
  }
}
