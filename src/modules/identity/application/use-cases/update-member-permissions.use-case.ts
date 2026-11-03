import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";
import { toOutputMembership } from "../mappers/toOutputMembership";

import {
  UpdateMemberPermissionsDeps,
  UpdateMemberPermissionsInput,
  UpdateMemberPermissionsOutput,
} from "./update-member-permissions.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";

/** Nobody changes their own permissions, so nobody locks themselves out. */
export class UpdateMemberPermissionsUseCase extends UseCase<{
  input: UpdateMemberPermissionsInput;
  output: UpdateMemberPermissionsOutput;
  deps: UpdateMemberPermissionsDeps;
  actor: Actor;
}> {
  readonly access = {
    permissions: [IdentityPermission.MEMBER_PERMISSIONS_UPDATE],
  };

  async execute(
    input: UpdateMemberPermissionsInput,
    actor: Actor,
  ): Promise<UpdateMemberPermissionsOutput> {
    if (actor.accountId === input.accountId) {
      throw new AppError(IdentityError.Forbidden, {
        actorAccountId: actor.accountId,
      });
    }

    const membership = await this.deps.membershipResolver.resolveActive(
      input.accountId,
    );

    const previous = [...membership.permissions];
    membership.updatePermissions(input.permissions, this.deps.clock.now());
    this.deps.accessPolicy.ensureCanChangePermissions(
      actor,
      previous,
      membership.permissions,
    );
    await this.deps.memberships.save(membership);

    return { membership: toOutputMembership(membership) };
  }
}
