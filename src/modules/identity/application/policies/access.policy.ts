import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

/** Who may act on which account. */
export class AccessPolicy {
  /** Only an `ADMIN` may act on other accounts. */
  ensureAdmin(actor: Actor): void {
    if (actor.role !== MembershipRole.ADMIN) {
      throw new AppError(IdentityError.Forbidden, {
        actorAccountId: actor.accountId,
      });
    }
  }

  ensureCanInvite(actor: Actor): void {
    if (actor.permissions.includes(MembershipPermission.INVITE)) {
      return;
    }
    this.ensureAdmin(actor);
  }

  ensureCanGrant(
    actor: Actor,
    role: MembershipRole,
    permissions: readonly MembershipPermission[],
  ): void {
    if (actor.role === MembershipRole.ADMIN) {
      return;
    }
    const withinOwn = permissions.every((permission) =>
      actor.permissions.includes(permission),
    );
    if (role !== MembershipRole.USER || !withinOwn) {
      throw new AppError(IdentityError.Forbidden, {
        actorAccountId: actor.accountId,
      });
    }
  }

  /** The account owner or an admin. */
  ensureCanManageAccount(actor: Actor, accountId: string): void {
    if (actor.accountId === accountId) {
      return;
    }
    this.ensureAdmin(actor);
  }
}
