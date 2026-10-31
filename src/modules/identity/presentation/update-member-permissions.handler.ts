import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { UpdateMemberPermissionsOutput } from "@/identity/application/use-cases/update-member-permissions.types";
import { UpdateMemberPermissionsUseCase } from "@/identity/application/use-cases/update-member-permissions.use-case";
import { MembershipPermission } from "@/identity/domain/membership.entity";

const inputSchema = Type.Object({
  accountId: Type.String({ pattern: OBJECT_ID_PATTERN }),
  permissions: Type.Array(Type.Enum(Object.values(MembershipPermission))),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type UpdateMemberPermissionsHandlerDeps = {
  updateMemberPermissions: UpdateMemberPermissionsUseCase;
};

export class UpdateMemberPermissionsHandler extends Handler<{
  deps: UpdateMemberPermissionsHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: UpdateMemberPermissionsOutput;
}> {
  readonly name = "identity.update_member_permissions";
  readonly input = inputSchema;

  async handle(
    inbound: Inbound<Actor, Input>,
  ): Promise<UpdateMemberPermissionsOutput> {
    return this.deps.updateMemberPermissions.execute(
      inbound.input,
      inbound.actor,
    );
  }
}
