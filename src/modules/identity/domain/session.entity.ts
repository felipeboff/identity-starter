import { AppError } from "@shared/domain/errors/app-error";
import { Id } from "@shared/domain/value-objects/id.value-object";

import { IdentityError } from "./errors/identity.error";
import { TokenHash } from "./value-objects/token-hash.value-object";

export const SessionRevocationReason = {
  LOGOUT: "logout",
  REPLACED: "replaced",
  SECURITY: "security",
  PASSWORD_CHANGED: "password_changed",
} as const;

export type SessionRevocationReason =
  (typeof SessionRevocationReason)[keyof typeof SessionRevocationReason];

export type SessionRegister = {
  id: string;
  accountId: string;
  credentialId: string;
  membershipId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string;
  ipAddress: string;
};

export type SessionRestore = SessionRegister & {
  createdAt: Date;
  version: number;
  revokedAt: Date | null;
  acceptedByAccountId: string | null;
  revokedReason: SessionRevocationReason | null;
};

export type SessionSnapshot = SessionRestore;

export type SessionState = {
  readonly id: Id;
  readonly accountId: Id;
  readonly credentialId: Id;
  readonly membershipId: Id;
  readonly version: number;
  readonly createdAt: Date;
  readonly tokenHash: TokenHash;
  readonly expiresAt: Date;
  readonly userAgent: string;
  readonly ipAddress: string;
  revokedAt: Date | null;
  acceptedByAccountId: Id | null;
  revokedReason: SessionRevocationReason | null;
};

export class Session {
  private constructor(private readonly state: SessionState) {
    this.ensureValidRevocationReason(state.revokedReason);
  }

  public static register(input: SessionRegister, at: Date): Session {
    return new Session({
      id: Id.create(input.id),
      accountId: Id.create(input.accountId),
      credentialId: Id.create(input.credentialId),
      version: 0,
      createdAt: at,
      revokedAt: null,
      acceptedByAccountId: null,
      revokedReason: null,
      tokenHash: TokenHash.create(input.tokenHash),
      expiresAt: input.expiresAt,
      membershipId: Id.create(input.membershipId),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
  }

  public static restore(input: SessionRestore): Session {
    const acceptedByAccountId = input.acceptedByAccountId
      ? Id.create(input.acceptedByAccountId)
      : null;

    return new Session({
      id: Id.create(input.id),
      accountId: Id.create(input.accountId),
      credentialId: Id.create(input.credentialId),
      version: input.version,
      createdAt: input.createdAt,
      revokedAt: input.revokedAt,
      acceptedByAccountId,
      revokedReason: input.revokedReason,
      tokenHash: TokenHash.create(input.tokenHash),
      expiresAt: input.expiresAt,
      membershipId: Id.create(input.membershipId),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
  }

  public toSnapshot(): SessionSnapshot {
    return {
      id: this.state.id.value,
      accountId: this.state.accountId.value,
      credentialId: this.state.credentialId.value,
      version: this.state.version,
      createdAt: this.state.createdAt,
      revokedAt: this.state.revokedAt,
      acceptedByAccountId: this.state.acceptedByAccountId?.value ?? null,
      revokedReason: this.state.revokedReason,
      tokenHash: this.state.tokenHash.value,
      expiresAt: this.state.expiresAt,
      membershipId: this.state.membershipId.value,
      userAgent: this.state.userAgent,
      ipAddress: this.state.ipAddress,
    };
  }

  public get id(): Id {
    return this.state.id;
  }

  public get accountId(): Id {
    return this.state.accountId;
  }

  public get credentialId(): Id {
    return this.state.credentialId;
  }

  public get version(): number {
    return this.state.version;
  }

  public get createdAt(): Date {
    return this.state.createdAt;
  }

  public get revokedAt(): Date | null {
    return this.state.revokedAt;
  }

  public get acceptedByAccountId(): Id | null {
    return this.state.acceptedByAccountId;
  }

  public get revokedReason(): SessionRevocationReason | null {
    return this.state.revokedReason;
  }

  public get tokenHash(): TokenHash {
    return this.state.tokenHash;
  }

  public get expiresAt(): Date {
    return this.state.expiresAt;
  }

  public get membershipId(): Id {
    return this.state.membershipId;
  }

  public get userAgent(): string {
    return this.state.userAgent;
  }

  public get ipAddress(): string {
    return this.state.ipAddress;
  }

  public isRevoked(): boolean {
    return this.state.revokedAt !== null;
  }

  public isExpired(at: Date): boolean {
    return at >= this.state.expiresAt;
  }

  public isActive(at: Date): boolean {
    return !this.isRevoked() && !this.isExpired(at);
  }

  public revoke(
    reason: SessionRevocationReason,
    at: Date,
    acceptedByAccountId?: string,
  ): void {
    if (this.isRevoked()) {
      return;
    }

    this.ensureValidRevocationReason(reason);
    this.state.revokedAt = at;
    this.state.acceptedByAccountId = acceptedByAccountId
      ? Id.create(acceptedByAccountId)
      : null;
    this.state.revokedReason = reason;
  }

  private ensureValidRevocationReason(
    reason: SessionRevocationReason | null,
  ): void {
    if (reason === null) {
      return;
    }

    if (!Object.values(SessionRevocationReason).includes(reason)) {
      throw new AppError(IdentityError.InvalidSessionRevocationReason, {
        reason,
      });
    }
  }
}
