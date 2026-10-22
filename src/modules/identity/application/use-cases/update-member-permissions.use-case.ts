import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toOutputMembership } from "../mappers/toOutputMembership";

import {
  UpdateMemberPermissionsDeps,
  UpdateMemberPermissionsInput,
  UpdateMemberPermissionsOutput,
} from "./update-member-permissions.types";

export class UpdateMemberPermissionsUseCase extends UseCase<{
  input: UpdateMemberPermissionsInput;
  output: UpdateMemberPermissionsOutput;
  deps: UpdateMemberPermissionsDeps;
  actor: Actor;
}> {
  async execute(
    input: UpdateMemberPermissionsInput,
    actor: Actor,
  ): Promise<UpdateMemberPermissionsOutput> {
    this.deps.accessPolicy.ensureAdmin(actor);

    const membership = await this.deps.membershipResolver.resolveActive(
      input.accountId,
    );

    membership.updatePermissions(input.permissions, this.deps.clock.now());
    await this.deps.memberships.save(membership);

    return { membership: toOutputMembership(membership) };
  }
}
