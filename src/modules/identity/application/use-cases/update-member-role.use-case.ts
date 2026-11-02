import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";
import { toOutputMembership } from "../mappers/toOutputMembership";

import {
  UpdateMemberRoleDeps,
  UpdateMemberRoleInput,
  UpdateMemberRoleOutput,
} from "./update-member-role.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipPermission } from "@/identity/domain/membership.entity";

/** Nobody changes their own role. */
export class UpdateMemberRoleUseCase extends UseCase<{
  input: UpdateMemberRoleInput;
  output: UpdateMemberRoleOutput;
  deps: UpdateMemberRoleDeps;
  actor: Actor;
}> {
  readonly access = { permissions: [MembershipPermission.MEMBER_ROLE_UPDATE] };

  async execute(
    input: UpdateMemberRoleInput,
    actor: Actor,
  ): Promise<UpdateMemberRoleOutput> {
    if (actor.accountId === input.accountId) {
      throw new AppError(IdentityError.Forbidden, {
        actorAccountId: actor.accountId,
      });
    }

    const membership = await this.deps.membershipResolver.resolveActive(
      input.accountId,
    );

    membership.updateRole(input.role, this.deps.clock.now());
    await this.deps.memberships.save(membership);

    return { membership: toOutputMembership(membership) };
  }
}
