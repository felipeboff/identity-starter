import { AppError } from "@shared/domain/errors/app-error";
import { Id } from "@shared/domain/value-objects/id.value-object";

import { IdentityError } from "./errors/identity.error";

/** One code per use case that requires a permission. */
export const MembershipPermission = {
  INVITATION_CREATE: "invitation.create",
  INVITATION_READ: "invitation.read",
  INVITATION_REVOKE: "invitation.revoke",
  ACCOUNT_REACTIVATE: "account.reactivate",
  ACCOUNT_DEACTIVATE: "account.deactivate",
  SESSION_REVOKE: "session.revoke",
  SESSION_REVOKE_ALL: "session.revoke_all",
  MEMBER_ROLE_UPDATE: "member.role.update",
  MEMBER_PERMISSIONS_UPDATE: "member.permissions.update",
} as const;

export type MembershipPermission =
  (typeof MembershipPermission)[keyof typeof MembershipPermission];

export const MembershipRole = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type MembershipRole =
  (typeof MembershipRole)[keyof typeof MembershipRole];

export type MembershipRegister = {
  id: string;
  role: MembershipRole;
  permissions: MembershipPermission[];
  createdBy: string;
  accountId: string;
};

export type MembershipRestore = MembershipRegister & {
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt: Date | null;
};

export type MembershipSnapshot = MembershipRestore;

export type MembershipState = {
  readonly id: Id;
  role: MembershipRole;
  permissions: MembershipPermission[];
  version: number;
  readonly createdBy: Id;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  readonly accountId: Id;
};

export class Membership {
  private constructor(private readonly state: MembershipState) {
    this.ensureValidRole(state.role);
    this.ensureValidPermissions(state.permissions);
  }

  public static register(input: MembershipRegister, at: Date): Membership {
    return new Membership({
      id: Id.create(input.id),
      role: input.role,
      permissions: [...input.permissions],
      version: 0,
      createdBy: Id.create(input.createdBy),
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      accountId: Id.create(input.accountId),
    });
  }

  public static restore(input: MembershipRestore): Membership {
    return new Membership({
      id: Id.create(input.id),
      role: input.role,
      permissions: [...input.permissions],
      version: input.version,
      createdBy: Id.create(input.createdBy),
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      deletedAt: input.deletedAt,
      accountId: Id.create(input.accountId),
    });
  }

  public toSnapshot(): MembershipSnapshot {
    return {
      id: this.state.id.value,
      role: this.state.role,
      permissions: [...this.state.permissions],
      version: this.state.version,
      createdBy: this.state.createdBy.value,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      deletedAt: this.state.deletedAt,
      accountId: this.state.accountId.value,
    };
  }

  public get id(): Id {
    return this.state.id;
  }

  public get role(): MembershipRole {
    return this.state.role;
  }

  public get permissions(): MembershipPermission[] {
    return [...this.state.permissions];
  }

  public get version(): number {
    return this.state.version;
  }

  public markAsSaved(): void {
    this.state.version += 1;
  }

  public get createdBy(): Id {
    return this.state.createdBy;
  }

  public get createdAt(): Date {
    return this.state.createdAt;
  }

  public get updatedAt(): Date {
    return this.state.updatedAt;
  }

  public get deletedAt(): Date | null {
    return this.state.deletedAt;
  }

  public get accountId(): Id {
    return this.state.accountId;
  }

  public isDeleted(): boolean {
    return this.state.deletedAt !== null;
  }

  public updateRole(role: MembershipRole, at: Date): void {
    this.ensureNotDeleted();
    this.ensureValidRole(role);
    this.state.role = role;
    this.touch(at);
  }

  public updatePermissions(
    permissions: MembershipPermission[],
    at: Date,
  ): void {
    this.ensureNotDeleted();
    this.ensureValidPermissions(permissions);
    this.state.permissions = [...permissions];
    this.touch(at);
  }

  public markAsDeleted(at: Date): void {
    if (this.isDeleted()) {
      return;
    }

    this.state.deletedAt = at;
    this.touch(at);
  }

  public reactivate(at: Date): void {
    if (!this.isDeleted()) {
      return;
    }

    this.state.deletedAt = null;
    this.touch(at);
  }

  private ensureNotDeleted(): void {
    if (this.isDeleted()) {
      throw new AppError(IdentityError.MembershipDeleted, {
        membershipId: this.state.id.value,
      });
    }
  }

  private touch(at: Date): void {
    this.state.updatedAt = at;
  }

  private ensureValidRole(role: MembershipRole): void {
    if (!Object.values(MembershipRole).includes(role)) {
      throw new AppError(IdentityError.InvalidMembershipRole, {
        role,
      });
    }
  }

  private ensureValidPermissions(permissions: MembershipPermission[]): void {
    if (
      !permissions.every((permission) =>
        Object.values(MembershipPermission).includes(permission),
      )
    ) {
      throw new AppError(IdentityError.InvalidMembershipPermissions, {
        permissions,
      });
    }
  }
}
