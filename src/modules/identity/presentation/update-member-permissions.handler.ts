import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import {
  UpdateMemberPermissionsInput,
  UpdateMemberPermissionsOutput,
} from "@/identity/application/use-cases/update-member-permissions.types";
import { UpdateMemberPermissionsUseCase } from "@/identity/application/use-cases/update-member-permissions.use-case";
import { MembershipPermission } from "@/identity/domain/membership.entity";

const inputSchema = v.object<UpdateMemberPermissionsInput>({
  accountId: v.objectId(),
  permissions: v.array(v.enum({ values: Object.values(MembershipPermission) })),
});

export type UpdateMemberPermissionsHandlerDeps = {
  updateMemberPermissions: UpdateMemberPermissionsUseCase;
};

export class UpdateMemberPermissionsHandler extends Handler<{
  deps: UpdateMemberPermissionsHandlerDeps;
  actor: Actor;
  output: UpdateMemberPermissionsOutput;
}> {
  async handle(
    inbound: Inbound<Actor>,
  ): Promise<UpdateMemberPermissionsOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.updateMemberPermissions.execute(input, inbound.actor);
  }
}
