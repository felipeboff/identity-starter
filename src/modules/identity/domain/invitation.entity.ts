import { AppError } from "@shared/domain/errors/app-error";
import { Email } from "@shared/domain/value-objects/email.value-object";
import { Id } from "@shared/domain/value-objects/id.value-object";

import { IdentityError } from "./errors/identity.error";
import { MembershipPermission, MembershipRole } from "./membership.entity";
import { TokenHash } from "./value-objects/token-hash.value-object";

export type InvitationRegister = {
  id: string;
  email: string;
  role: MembershipRole;
  permissions: MembershipPermission[];
  tokenHash: string;
  expiresAt: Date;
  createdBy: string;
};

export type InvitationRestore = InvitationRegister & {
  createdAt: Date;
  updatedAt: Date;
  version: number;
  acceptedAt: Date | null;
  acceptedByAccountId: string | null;
  revokedAt: Date | null;
};

export type InvitationSnapshot = InvitationRestore;

export type InvitationState = {
  readonly id: Id;
  readonly email: Email;
  role: MembershipRole;
  permissions: MembershipPermission[];
  readonly tokenHash: TokenHash;
  readonly expiresAt: Date;
  readonly createdBy: Id;
  readonly version: number;
  readonly createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  acceptedByAccountId: Id | null;
  revokedAt: Date | null;
};

export class Invitation {
  private constructor(private readonly state: InvitationState) {
    this.ensureValidRole(state.role);
    this.ensureValidPermissions(state.permissions);
  }

  public static register(input: InvitationRegister, at: Date): Invitation {
    return new Invitation({
      id: Id.create(input.id),
      email: Email.create(input.email),
      role: input.role,
      permissions: [...input.permissions],
      tokenHash: TokenHash.create(input.tokenHash),
      expiresAt: input.expiresAt,
      createdBy: Id.create(input.createdBy),
      version: 0,
      createdAt: at,
      updatedAt: at,
      acceptedAt: null,
      acceptedByAccountId: null,
      revokedAt: null,
    });
  }

  public static restore(input: InvitationRestore): Invitation {
    const acceptedByAccountId = input.acceptedByAccountId
      ? Id.create(input.acceptedByAccountId)
      : null;

    return new Invitation({
      id: Id.create(input.id),
      email: Email.create(input.email),
      role: input.role,
      permissions: [...input.permissions],
      tokenHash: TokenHash.create(input.tokenHash),
      expiresAt: input.expiresAt,
      createdBy: Id.create(input.createdBy),
      version: input.version,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      acceptedAt: input.acceptedAt,
      acceptedByAccountId,
      revokedAt: input.revokedAt,
    });
  }

  public toSnapshot(): InvitationSnapshot {
    return {
      id: this.state.id.value,
      email: this.state.email.value,
      role: this.state.role,
      permissions: [...this.state.permissions],
      tokenHash: this.state.tokenHash.value,
      expiresAt: this.state.expiresAt,
      createdBy: this.state.createdBy.value,
      version: this.state.version,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      acceptedAt: this.state.acceptedAt,
      acceptedByAccountId: this.state.acceptedByAccountId?.value ?? null,
      revokedAt: this.state.revokedAt,
    };
  }

  public get id(): Id {
    return this.state.id;
  }

  public get email(): Email {
    return this.state.email;
  }

  public get role(): MembershipRole {
    return this.state.role;
  }

  public get permissions(): MembershipPermission[] {
    return [...this.state.permissions];
  }

  public get tokenHash(): TokenHash {
    return this.state.tokenHash;
  }

  public get expiresAt(): Date {
    return this.state.expiresAt;
  }

  public get createdBy(): Id {
    return this.state.createdBy;
  }

  public get version(): number {
    return this.state.version;
  }

  public get createdAt(): Date {
    return this.state.createdAt;
  }

  public get updatedAt(): Date {
    return this.state.updatedAt;
  }

  public get acceptedAt(): Date | null {
    return this.state.acceptedAt;
  }

  public get acceptedByAccountId(): Id | null {
    return this.state.acceptedByAccountId;
  }

  public get revokedAt(): Date | null {
    return this.state.revokedAt;
  }

  public isAccepted(): boolean {
    return this.state.acceptedAt !== null;
  }

  public isRevoked(): boolean {
    return this.state.revokedAt !== null;
  }

  public isExpired(at: Date): boolean {
    return at >= this.state.expiresAt;
  }

  public isPending(at: Date): boolean {
    return !this.isAccepted() && !this.isRevoked() && !this.isExpired(at);
  }

  public updateRole(role: MembershipRole, at: Date): void {
    this.ensurePending(at);
    this.ensureValidRole(role);
    this.state.role = role;
    this.touch(at);
  }

  public updatePermissions(
    permissions: MembershipPermission[],
    at: Date,
  ): void {
    this.ensurePending(at);
    this.ensureValidPermissions(permissions);
    this.state.permissions = [...permissions];
    this.touch(at);
  }

  public accept(accountId: string, at: Date): void {
    if (this.isAccepted()) {
      return;
    }

    this.ensurePending(at);
    this.state.acceptedAt = at;
    this.state.acceptedByAccountId = Id.create(accountId);
    this.touch(at);
  }

  public revoke(at: Date): void {
    if (this.isRevoked()) {
      return;
    }

    if (this.isAccepted()) {
      throw new AppError(IdentityError.InvitationAlreadyAccepted);
    }

    this.state.revokedAt = at;
    this.touch(at);
  }

  private ensurePending(at: Date): void {
    if (this.isAccepted()) {
      throw new AppError(IdentityError.InvitationAlreadyAccepted);
    }

    if (this.isRevoked()) {
      throw new AppError(IdentityError.InvitationRevoked);
    }

    if (this.isExpired(at)) {
      throw new AppError(IdentityError.InvitationExpired);
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
