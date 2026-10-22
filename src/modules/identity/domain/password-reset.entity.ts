import { AppError } from "@shared/domain/errors/app-error";
import { Id } from "@shared/domain/value-objects/id.value-object";

import { IdentityError } from "./errors/identity.error";
import { TokenHash } from "./value-objects/token-hash.value-object";

export type PasswordResetRegister = {
  id: string;
  accountId: string;
  credentialId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type PasswordResetRestore = PasswordResetRegister & {
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt?: Date | null;
  consumedAt?: Date | null;
};

export type PasswordResetSnapshot = PasswordResetRestore;

export type PasswordResetState = {
  readonly id: Id;
  readonly accountId: Id;
  readonly credentialId: Id;
  readonly tokenHash: TokenHash;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  updatedAt: Date;
  readonly version: number;
  deletedAt: Date | null;
  consumedAt: Date | null;
};

export class PasswordReset {
  private constructor(private readonly state: PasswordResetState) {}

  public static register(
    input: PasswordResetRegister,
    at: Date,
  ): PasswordReset {
    return new PasswordReset({
      id: Id.create(input.id),
      accountId: Id.create(input.accountId),
      credentialId: Id.create(input.credentialId),
      tokenHash: TokenHash.create(input.tokenHash),
      expiresAt: input.expiresAt,
      createdAt: at,
      updatedAt: at,
      version: 0,
      deletedAt: null,
      consumedAt: null,
    });
  }

  public static restore(input: PasswordResetRestore): PasswordReset {
    return new PasswordReset({
      id: Id.create(input.id),
      accountId: Id.create(input.accountId),
      credentialId: Id.create(input.credentialId),
      tokenHash: TokenHash.create(input.tokenHash),
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      version: input.version,
      deletedAt: input.deletedAt ?? null,
      consumedAt: input.consumedAt ?? null,
    });
  }

  public toSnapshot(): PasswordResetSnapshot {
    return {
      id: this.state.id.value,
      accountId: this.state.accountId.value,
      credentialId: this.state.credentialId.value,
      tokenHash: this.state.tokenHash.value,
      expiresAt: this.state.expiresAt,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      version: this.state.version,
      deletedAt: this.state.deletedAt,
      consumedAt: this.state.consumedAt,
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

  public get tokenHash(): TokenHash {
    return this.state.tokenHash;
  }

  public get expiresAt(): Date {
    return this.state.expiresAt;
  }

  public get createdAt(): Date {
    return this.state.createdAt;
  }

  public get updatedAt(): Date {
    return this.state.updatedAt;
  }

  public get version(): number {
    return this.state.version;
  }

  public get deletedAt(): Date | null {
    return this.state.deletedAt;
  }

  public get consumedAt(): Date | null {
    return this.state.consumedAt;
  }

  public isConsumed(): boolean {
    return this.state.consumedAt !== null;
  }

  public isDeleted(): boolean {
    return this.state.deletedAt !== null;
  }

  public isExpired(at: Date): boolean {
    return at >= this.state.expiresAt;
  }

  public isPending(at: Date): boolean {
    return !this.isConsumed() && !this.isDeleted() && !this.isExpired(at);
  }

  public consume(at: Date): void {
    if (this.isConsumed()) {
      return;
    }

    this.ensurePending(at);
    this.state.consumedAt = at;
    this.touch(at);
  }

  public markAsDeleted(at: Date): void {
    if (this.isDeleted()) {
      return;
    }

    this.state.deletedAt = at;
    this.touch(at);
  }

  private ensurePending(at: Date): void {
    if (this.isDeleted()) {
      throw new AppError(IdentityError.PasswordResetDeleted);
    }

    if (this.isExpired(at)) {
      throw new AppError(IdentityError.PasswordResetExpired);
    }
  }

  private touch(at: Date): void {
    this.state.updatedAt = at;
  }
}
