import { AppError } from "@shared/domain/errors/app-error";
import { PermissionCatalog } from "@shared/domain/value-objects/permission-catalog.value-object";

import { Actor } from "../actor";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";

type AccessPolicyDeps = {
  permissions: PermissionCatalog;
};

/** Who may act on which account. Reads permissions only; the role is a label. */
export class AccessPolicy {
  constructor(private readonly deps: AccessPolicyDeps) {}

  /** The account owner, or a holder of the permission for acting on someone else's account. */
  ensureCanManageAccount(
    actor: Actor,
    accountId: string,
    permission: IdentityPermission,
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
  ensureCanGrant(actor: Actor, permissions: readonly string[]): void {
    this.ensureKnown(permissions);
    this.ensureHolds(actor, permissions);
  }

  /** Nobody adds or removes a permission they do not hold; the others stay as they are. */
  ensureCanChangePermissions(
    actor: Actor,
    from: readonly string[],
    to: readonly string[],
  ): void {
    const added = to.filter((permission) => !from.includes(permission));
    const removed = from.filter((permission) => !to.includes(permission));
    this.ensureKnown(added);
    this.ensureHolds(actor, [
      ...added,
      ...removed.filter((permission) =>
        this.deps.permissions.includes(permission),
      ),
    ]);
  }

  private ensureKnown(permissions: readonly string[]): void {
    const unknown = permissions.filter(
      (permission) => !this.deps.permissions.includes(permission),
    );
    if (unknown.length === 0) {
      return;
    }
    throw new AppError(IdentityError.InvalidMembershipPermissions, {
      permissions: unknown,
    });
  }

  private ensureHolds(actor: Actor, permissions: readonly string[]): void {
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
