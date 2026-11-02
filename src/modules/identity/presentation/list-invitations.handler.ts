import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { invitationOutputSchema } from "./output.schema";

import { Actor } from "@/identity/application/actor";
import { ListInvitationsOutput } from "@/identity/application/use-cases/list-invitations.types";
import { ListInvitationsUseCase } from "@/identity/application/use-cases/list-invitations.use-case";

const outputSchema = Type.Object({
  invitations: Type.Array(invitationOutputSchema),
});

export type ListInvitationsHandlerDeps = {
  listInvitations: ListInvitationsUseCase;
};

export class ListInvitationsHandler extends Handler<{
  deps: ListInvitationsHandlerDeps;
  actor: Actor;
  output: typeof outputSchema;
}> {
  readonly name = "identity.list_invitations";
  readonly output = outputSchema;

  async handle(inbound: Inbound<Actor>): Promise<ListInvitationsOutput> {
    return this.deps.listInvitations.execute(inbound.actor);
  }
}
