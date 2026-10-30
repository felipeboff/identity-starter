import { AppError } from "@shared/domain/errors/app-error";
import { Email } from "@shared/domain/value-objects/email.value-object";
import { Id } from "@shared/domain/value-objects/id.value-object";

import { IdentityError } from "./errors/identity.error";
import { PasswordHash } from "./value-objects/password-hash.value-object";

export const AuthProvider = {
  EMAIL: "email",
  GOOGLE: "google",
  GITHUB: "github",
  APPLE: "apple",
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export type CredentialRegisterBase = {
  id: string;
  accountId: string;
  subject: string;
};

export type CredentialRegisterEmail = CredentialRegisterBase & {
  provider: typeof AuthProvider.EMAIL;
  passwordHash: string;
  providerEmail: string;
};

export type CredentialRegisterOAuth = CredentialRegisterBase & {
  provider: Exclude<AuthProvider, typeof AuthProvider.EMAIL>;
  passwordHash?: null;
  providerEmail?: string | null;
};

export type CredentialRegister =
  CredentialRegisterEmail | CredentialRegisterOAuth;

export type CredentialRestore = CredentialRegister & {
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deletedAt: Date | null;
};

export type CredentialSnapshot = CredentialRestore;

export type CredentialState = {
  readonly id: Id;
  readonly accountId: Id;
  readonly provider: AuthProvider;
  subject: string | Email;
  passwordHash: PasswordHash | null;
  providerEmail: Email | null;
  version: number;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export class Credential {
  private constructor(private readonly state: CredentialState) {
    this.ensureValidEmailCredential();
  }

  public static register(input: CredentialRegister, at: Date): Credential {
    const passwordHash = input.passwordHash
      ? PasswordHash.create(input.passwordHash)
      : null;

    const providerEmail = input.providerEmail
      ? Email.create(input.providerEmail)
      : null;

    return new Credential({
      id: Id.create(input.id),
      accountId: Id.create(input.accountId),
      provider: input.provider,
      subject: Credential.createSubject(input.provider, input.subject),
      passwordHash,
      providerEmail,
      version: 0,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });
  }

  public static restore(input: CredentialRestore): Credential {
    const providerEmail = input.providerEmail
      ? Email.create(input.providerEmail)
      : null;

    const passwordHash = input.passwordHash
      ? PasswordHash.create(input.passwordHash)
      : null;

    return new Credential({
      id: Id.create(input.id),
      accountId: Id.create(input.accountId),
      provider: input.provider,
      subject: Credential.createSubject(input.provider, input.subject),
      passwordHash,
      providerEmail,
      version: input.version,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      deletedAt: input.deletedAt,
    });
  }

  public toSnapshot(): CredentialSnapshot {
    const common = {
      id: this.state.id.value,
      accountId: this.state.accountId.value,
      subject: this.subjectValue(),
      version: this.state.version,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      deletedAt: this.state.deletedAt,
    };

    if (this.state.provider === AuthProvider.EMAIL) {
      return {
        ...common,
        provider: AuthProvider.EMAIL,
        passwordHash: this.state.passwordHash!.value,
        providerEmail: this.state.providerEmail!.value,
      };
    }

    return {
      ...common,
      provider: this.state.provider,
      passwordHash: null,
      providerEmail: this.state.providerEmail?.value ?? null,
    };
  }

  public get id(): Id {
    return this.state.id;
  }

  public get accountId(): Id {
    return this.state.accountId;
  }

  public get provider(): AuthProvider {
    return this.state.provider;
  }

  public get subject(): string | Email {
    return this.state.subject;
  }

  public subjectValue(): string {
    return this.state.subject instanceof Email
      ? this.state.subject.value
      : this.state.subject;
  }

  public get passwordHash(): PasswordHash | null {
    return this.state.passwordHash;
  }

  public get providerEmail(): Email | null {
    return this.state.providerEmail;
  }

  public get version(): number {
    return this.state.version;
  }

  public markAsSaved(): void {
    this.state.version += 1;
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

  public isDeleted(): boolean {
    return this.state.deletedAt !== null;
  }

  public updatePasswordHash(passwordHash: string, at: Date): void {
    this.ensureNotDeleted();

    if (this.state.provider !== AuthProvider.EMAIL) {
      throw new AppError(IdentityError.PasswordHashNotAllowedForProvider, {
        provider: this.state.provider,
      });
    }

    this.state.passwordHash = PasswordHash.create(passwordHash);
    this.touch(at);
  }

  public updateProviderEmail(providerEmail: string | null, at: Date): void {
    this.ensureNotDeleted();

    const nextProviderEmail = providerEmail
      ? Email.create(providerEmail)
      : null;

    this.ensureValidEmailCredential(nextProviderEmail);
    this.state.providerEmail = nextProviderEmail;
    this.touch(at);
  }

  public changeEmail(email: string, at: Date): void {
    this.ensureNotDeleted();
    if (this.state.provider !== AuthProvider.EMAIL) {
      throw new AppError(IdentityError.EmailChangeNeedsPassword, {
        accountId: this.state.accountId.value,
      });
    }

    this.state.subject = Email.create(email);
    this.state.providerEmail = Email.create(email);
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
      throw new AppError(IdentityError.CredentialDeleted, {
        credentialId: this.state.id.value,
      });
    }
  }

  private ensureValidEmailCredential(
    providerEmail = this.state.providerEmail,
  ): void {
    if (this.state.provider !== AuthProvider.EMAIL) {
      return;
    }

    if (providerEmail == null) {
      throw new AppError(IdentityError.ProviderEmailRequiredForEmail);
    }

    const subject = this.subjectValue();

    if (subject !== providerEmail.value) {
      throw new AppError(IdentityError.SubjectDoesNotMatchProviderEmail, {
        subject,
        providerEmail: providerEmail.value,
      });
    }
  }

  private static createSubject(
    provider: AuthProvider,
    subject: string,
  ): string | Email {
    return provider === AuthProvider.EMAIL ? Email.create(subject) : subject;
  }

  private touch(at: Date): void {
    this.state.updatedAt = at;
  }
}
