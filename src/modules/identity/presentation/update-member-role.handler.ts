import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import {
  UpdateMemberRoleInput,
  UpdateMemberRoleOutput,
} from "@/identity/application/use-cases/update-member-role.types";
import { UpdateMemberRoleUseCase } from "@/identity/application/use-cases/update-member-role.use-case";
import { MembershipRole } from "@/identity/domain/membership.entity";

const inputSchema = v.object<UpdateMemberRoleInput>({
  accountId: v.objectId(),
  role: v.enum({ values: Object.values(MembershipRole) }),
});

export type UpdateMemberRoleHandlerDeps = {
  updateMemberRole: UpdateMemberRoleUseCase;
};

export class UpdateMemberRoleHandler extends Handler<{
  deps: UpdateMemberRoleHandlerDeps;
  actor: Actor;
  output: UpdateMemberRoleOutput;
}> {
  async handle(inbound: Inbound<Actor>): Promise<UpdateMemberRoleOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.updateMemberRole.execute(input, inbound.actor);
  }
}
