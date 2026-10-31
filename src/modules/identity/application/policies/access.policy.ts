import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipPermission } from "@/identity/domain/membership.entity";

/** Who may act on which account. Reads permissions only; the role is a label. */
export class AccessPolicy {
  /** The account owner, or a holder of the permission for acting on someone else's account. */
  ensureCanManageAccount(
    actor: Actor,
    accountId: string,
    permission: MembershipPermission,
  ): void {
    if (
      actor.accountId === accountId ||
      actor.permissions.includes(permission)
    ) {
      return;
    }
    throw new AppError(IdentityError.Forbidden, {
      actorAccountId: actor.accountId,
    });
  }

  /** Nobody grants a permission they do not hold. */
  ensureCanGrant(
    actor: Actor,
    permissions: readonly MembershipPermission[],
  ): void {
    if (
      permissions.every((permission) => actor.permissions.includes(permission))
    ) {
      return;
    }
    throw new AppError(IdentityError.Forbidden, {
      actorAccountId: actor.accountId,
    });
  }
}
