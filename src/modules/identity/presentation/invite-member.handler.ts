import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { invitationOutputSchema } from "./output.schema";
import { permissionsSchema } from "./permissions.schema";

import { Actor } from "@/identity/application/actor";
import { InviteMemberOutput } from "@/identity/application/use-cases/invite-member.types";
import { InviteMemberUseCase } from "@/identity/application/use-cases/invite-member.use-case";
import { MembershipRole } from "@/identity/domain/membership.entity";

const inputSchema = Type.Object({
  email: Type.String({ format: "email" }),
  role: Type.Enum(Object.values(MembershipRole)),
  permissions: permissionsSchema,
});

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object({ invitation: invitationOutputSchema });

export type InviteMemberHandlerDeps = {
  inviteMember: InviteMemberUseCase;
};

export class InviteMemberHandler extends Handler<{
  deps: InviteMemberHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.invite_member";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<InviteMemberOutput> {
    return this.deps.inviteMember.execute(inbound.input, inbound.actor);
  }
}
