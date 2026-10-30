import { AppError } from "@shared/domain/errors/app-error";
import { Email } from "@shared/domain/value-objects/email.value-object";
import { Id } from "@shared/domain/value-objects/id.value-object";

import { IdentityError } from "./errors/identity.error";
import { TokenHash } from "./value-objects/token-hash.value-object";

export type EmailChangeRegister = {
  id: string;
  accountId: string;
  newEmail: string;
  tokenHash: string;
  expiresAt: Date;
};

export type EmailChangeRestore = EmailChangeRegister & {
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt?: Date | null;
  consumedAt?: Date | null;
};

export type EmailChangeSnapshot = EmailChangeRestore;

export type EmailChangeState = {
  readonly id: Id;
  readonly accountId: Id;
  readonly newEmail: Email;
  readonly tokenHash: TokenHash;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt: Date | null;
  consumedAt: Date | null;
};

export class EmailChange {
  private constructor(private readonly state: EmailChangeState) {}

  public static register(input: EmailChangeRegister, at: Date): EmailChange {
    return new EmailChange({
      id: Id.create(input.id),
      accountId: Id.create(input.accountId),
      newEmail: Email.create(input.newEmail),
      tokenHash: TokenHash.create(input.tokenHash),
      expiresAt: input.expiresAt,
      createdAt: at,
      updatedAt: at,
      version: 0,
      deletedAt: null,
      consumedAt: null,
    });
  }

  public static restore(input: EmailChangeRestore): EmailChange {
    return new EmailChange({
      id: Id.create(input.id),
      accountId: Id.create(input.accountId),
      newEmail: Email.create(input.newEmail),
      tokenHash: TokenHash.create(input.tokenHash),
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      version: input.version,
      deletedAt: input.deletedAt ?? null,
      consumedAt: input.consumedAt ?? null,
    });
  }

  public toSnapshot(): EmailChangeSnapshot {
    return {
      id: this.state.id.value,
      accountId: this.state.accountId.value,
      newEmail: this.state.newEmail.value,
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

  public get newEmail(): Email {
    return this.state.newEmail;
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

  public markAsSaved(): void {
    this.state.version += 1;
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
      throw new AppError(IdentityError.EmailChangeDeleted);
    }

    if (this.isExpired(at)) {
      throw new AppError(IdentityError.EmailChangeExpired);
    }
  }

  private touch(at: Date): void {
    this.state.updatedAt = at;
  }
}
