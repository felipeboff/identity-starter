import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import {
  InviteMemberInput,
  InviteMemberOutput,
} from "@/identity/application/use-cases/invite-member.types";
import { InviteMemberUseCase } from "@/identity/application/use-cases/invite-member.use-case";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

const inputSchema = v.object<InviteMemberInput>({
  email: v.email(),
  role: v.enum({ values: Object.values(MembershipRole) }),
  permissions: v.array(v.enum({ values: Object.values(MembershipPermission) })),
});

export type InviteMemberHandlerDeps = {
  inviteMember: InviteMemberUseCase;
};

export class InviteMemberHandler extends Handler<{
  deps: InviteMemberHandlerDeps;
  actor: Actor;
  output: InviteMemberOutput;
}> {
  async handle(inbound: Inbound<Actor>): Promise<InviteMemberOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.inviteMember.execute(input, inbound.actor);
  }
}
