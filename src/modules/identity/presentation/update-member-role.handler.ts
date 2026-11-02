import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { membershipOutputSchema } from "./output.schema";

import { Actor } from "@/identity/application/actor";
import { UpdateMemberRoleOutput } from "@/identity/application/use-cases/update-member-role.types";
import { UpdateMemberRoleUseCase } from "@/identity/application/use-cases/update-member-role.use-case";
import { MembershipRole } from "@/identity/domain/membership.entity";

const inputSchema = Type.Object({
  accountId: Type.String({ pattern: OBJECT_ID_PATTERN }),
  role: Type.Enum(Object.values(MembershipRole)),
});

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object({ membership: membershipOutputSchema });

export type UpdateMemberRoleHandlerDeps = {
  updateMemberRole: UpdateMemberRoleUseCase;
};

export class UpdateMemberRoleHandler extends Handler<{
  deps: UpdateMemberRoleHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.update_member_role";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(
    inbound: Inbound<Actor, Input>,
  ): Promise<UpdateMemberRoleOutput> {
    return this.deps.updateMemberRole.execute(inbound.input, inbound.actor);
  }
}
