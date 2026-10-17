import { AppError } from "../../../shared/domain/errors/app-error";
import { Email } from "../../../shared/domain/value-objects/email.value-object";
import { Id } from "../../../shared/domain/value-objects/id.value-object";

import { IdentityError } from "./errors/identity.error";

export type AccountRegister = {
  id: string;
  name: string;
  email: string;
  createdBy: string;
};

export type AccountRestore = AccountRegister & {
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt?: Date | null;
  lastSeenAt?: Date | null;
};

export type AccountSnapshot = AccountRestore;

export type AccountState = {
  readonly id: Id;
  name: string;
  readonly email: Email;
  readonly version: number;
  readonly createdBy: Id;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  lastSeenAt: Date | null;
};

export class Account {
  private constructor(private readonly state: AccountState) {}

  public static register(input: AccountRegister, at: Date): Account {
    return new Account({
      id: Id.create(input.id),
      name: input.name,
      email: Email.create(input.email),
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      lastSeenAt: null,
      version: 0,
      createdBy: Id.create(input.createdBy),
    });
  }

  public static restore(input: AccountRestore): Account {
    return new Account({
      id: Id.create(input.id),
      name: input.name,
      email: Email.create(input.email),
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      deletedAt: input.deletedAt ?? null,
      lastSeenAt: input.lastSeenAt ?? null,
      version: input.version,
      createdBy: Id.create(input.createdBy),
    });
  }

  public toSnapshot(): AccountSnapshot {
    return {
      id: this.state.id.value,
      name: this.state.name,
      email: this.state.email.value,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      deletedAt: this.state.deletedAt,
      lastSeenAt: this.state.lastSeenAt,
      version: this.state.version,
      createdBy: this.state.createdBy.value,
    };
  }

  public get id(): Id {
    return this.state.id;
  }

  public get name(): string {
    return this.state.name;
  }

  public get email(): Email {
    return this.state.email;
  }

  public get version(): number {
    return this.state.version;
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

  public get lastSeenAt(): Date | null {
    return this.state.lastSeenAt;
  }

  public isDeleted(): boolean {
    return this.state.deletedAt !== null;
  }

  public updateName(name: string, at: Date): void {
    this.ensureNotDeleted();
    this.state.name = name;
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

  public markAsLastSeen(at: Date): void {
    this.ensureNotDeleted();
    this.state.lastSeenAt = at;
    this.touch(at);
  }

  private ensureNotDeleted(): void {
    if (this.isDeleted()) {
      throw new AppError(IdentityError.AccountDeleted);
    }
  }

  private touch(at: Date): void {
    this.state.updatedAt = at;
  }
}
