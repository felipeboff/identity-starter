import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { Email } from "@shared/domain/value-objects/email.value-object";
import { describe, expect, it } from "vitest";

import { AuthProvider, Credential } from "./credential.entity";
import { IdentityError } from "./errors/identity.error";

describe("Credential", () => {
  describe("register", () => {
    it("creates an email credential with the given identity and default state", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const loginEmail = faker.internet.email().toLowerCase();
      const passwordHash = "$" + faker.internet.password({ length: 10 });
      const registeredAt = new Date();

      const credential = Credential.register(
        {
          id,
          accountId,
          subject: loginEmail,
          provider: AuthProvider.EMAIL,
          passwordHash,
          providerEmail: loginEmail,
        },
        registeredAt,
      );

      expect(credential.id.value).toBe(id);
      expect(credential.accountId.value).toBe(accountId);
      expect(credential.provider).toBe(AuthProvider.EMAIL);
      expect(credential.subject).toBeInstanceOf(Email);
      expect(credential.subject).toHaveProperty("value", loginEmail);
      expect(credential.subjectValue()).toBe(loginEmail);
      expect(credential.passwordHash?.value).toBe(passwordHash);
      expect(credential.providerEmail?.value).toBe(loginEmail);
      expect(credential.version).toBe(0);
      expect(credential.createdAt).toBe(registeredAt);
      expect(credential.updatedAt).toBe(registeredAt);
      expect(credential.deletedAt).toBeNull();
      expect(credential.isDeleted()).toBe(false);
    });

    it("creates an oauth credential without password hash or provider email", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const providerSubject = faker.string.numeric(21);
      const registeredAt = new Date();

      const credential = Credential.register(
        {
          id,
          accountId,
          subject: providerSubject,
          provider: AuthProvider.GOOGLE,
        },
        registeredAt,
      );

      expect(credential.id.value).toBe(id);
      expect(credential.accountId.value).toBe(accountId);
      expect(credential.provider).toBe(AuthProvider.GOOGLE);
      expect(credential.subject).toBe(providerSubject);
      expect(credential.subjectValue()).toBe(providerSubject);
      expect(credential.passwordHash).toBeNull();
      expect(credential.providerEmail).toBeNull();
      expect(credential.version).toBe(0);
      expect(credential.createdAt).toBe(registeredAt);
      expect(credential.updatedAt).toBe(registeredAt);
      expect(credential.deletedAt).toBeNull();
      expect(credential.isDeleted()).toBe(false);
    });

    it("throws when an email credential has no provider email", () => {
      expect(() =>
        Credential.register(
          {
            id: faker.database.mongodbObjectId(),
            accountId: faker.database.mongodbObjectId(),
            subject: faker.internet.email().toLowerCase(),
            provider: AuthProvider.EMAIL,
            passwordHash: "$" + faker.internet.password({ length: 10 }),
            providerEmail: null,
          } as never,
          new Date(),
        ),
      ).toThrow(IdentityError.ProviderEmailRequiredForEmail.code);
    });

    it("throws when an email credential subject does not match provider email", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const otherEmail = faker.internet.email().toLowerCase();

      expect(() =>
        Credential.register(
          {
            id: faker.database.mongodbObjectId(),
            accountId: faker.database.mongodbObjectId(),
            subject: loginEmail,
            provider: AuthProvider.EMAIL,
            passwordHash: "$" + faker.internet.password({ length: 10 }),
            providerEmail: otherEmail,
          },
          new Date(),
        ),
      ).toThrow(IdentityError.SubjectDoesNotMatchProviderEmail.code);
    });
  });

  describe("restore", () => {
    it("rebuilds an email credential from persisted state", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const loginEmail = faker.internet.email().toLowerCase();
      const passwordHash = "$" + faker.internet.password({ length: 10 });
      const persistedAt = new Date();

      const credential = Credential.restore({
        id,
        accountId,
        subject: loginEmail,
        provider: AuthProvider.EMAIL,
        passwordHash,
        providerEmail: loginEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });

      expect(credential.toSnapshot()).toEqual({
        id,
        accountId,
        provider: AuthProvider.EMAIL,
        subject: loginEmail,
        passwordHash,
        providerEmail: loginEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });
    });

    it("rebuilds an oauth credential from persisted state", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const providerSubject = faker.string.numeric(21);
      const persistedAt = new Date();

      const credential = Credential.restore({
        id,
        accountId,
        subject: providerSubject,
        provider: AuthProvider.GOOGLE,
        passwordHash: null,
        providerEmail: null,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });

      expect(credential.toSnapshot()).toEqual({
        id,
        accountId,
        provider: AuthProvider.GOOGLE,
        subject: providerSubject,
        passwordHash: null,
        providerEmail: null,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });
    });

    it("rebuilds an oauth credential with a provider email", () => {
      const providerSubject = faker.string.numeric(21);
      const providerEmail = faker.internet.email().toLowerCase();
      const persistedAt = new Date();

      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: providerSubject,
        provider: AuthProvider.GITHUB,
        passwordHash: null,
        providerEmail,
        version: 1,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });

      expect(credential.providerEmail?.value).toBe(providerEmail);
      expect(credential.toSnapshot().providerEmail).toBe(providerEmail);
    });
  });

  describe("updatePasswordHash", () => {
    it("replaces the password hash of an email credential", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: loginEmail,
        provider: AuthProvider.EMAIL,
        passwordHash: "$" + faker.internet.password({ length: 10 }),
        providerEmail: loginEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });
      const updatedPasswordHash = "$" + faker.internet.password({ length: 10 });
      const updatedAt = new Date(persistedAt.getTime() + 1000);

      credential.updatePasswordHash(updatedPasswordHash, updatedAt);

      expect(credential.updatedAt).toBe(updatedAt);
      expect(credential.passwordHash?.value).toBe(updatedPasswordHash);
    });

    it("throws when the provider is not email", () => {
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: faker.string.numeric(21),
        provider: AuthProvider.GOOGLE,
        passwordHash: null,
        providerEmail: null,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });
      const updatedPasswordHash = "$" + faker.internet.password({ length: 10 });

      expect(() => {
        credential.updatePasswordHash(updatedPasswordHash, new Date());
      }).toThrow(AppError);
      expect(() => {
        credential.updatePasswordHash(updatedPasswordHash, new Date());
      }).toThrow(IdentityError.PasswordHashNotAllowedForProvider.code);
    });

    it("throws when the credential is deleted", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: loginEmail,
        provider: AuthProvider.EMAIL,
        passwordHash: "$" + faker.internet.password({ length: 10 }),
        providerEmail: loginEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });

      credential.markAsDeleted(new Date());

      expect(() => {
        credential.updatePasswordHash(
          "$" + faker.internet.password({ length: 10 }),
          new Date(),
        );
      }).toThrow(IdentityError.CredentialDeleted.code);
    });
  });

  describe("updateProviderEmail", () => {
    it("keeps the provider email when it still matches the email subject", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: loginEmail,
        provider: AuthProvider.EMAIL,
        passwordHash: "$" + faker.internet.password({ length: 10 }),
        providerEmail: loginEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });
      const updatedAt = new Date(persistedAt.getTime() + 1000);

      credential.updateProviderEmail(loginEmail, updatedAt);

      expect(credential.providerEmail?.value).toBe(loginEmail);
      expect(credential.updatedAt).toBe(updatedAt);
    });

    it("sets the provider email of an oauth credential", () => {
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: faker.string.numeric(21),
        provider: AuthProvider.APPLE,
        passwordHash: null,
        providerEmail: null,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });
      const providerEmail = faker.internet.email().toLowerCase();
      const updatedAt = new Date(persistedAt.getTime() + 1000);

      credential.updateProviderEmail(providerEmail, updatedAt);

      expect(credential.providerEmail?.value).toBe(providerEmail);
      expect(credential.updatedAt).toBe(updatedAt);
    });

    it("clears the provider email of an oauth credential", () => {
      const providerEmail = faker.internet.email().toLowerCase();
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: faker.string.numeric(21),
        provider: AuthProvider.GOOGLE,
        passwordHash: null,
        providerEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });

      credential.updateProviderEmail(null, new Date());

      expect(credential.providerEmail).toBeNull();
    });

    it("throws when clearing the provider email of an email credential", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: loginEmail,
        provider: AuthProvider.EMAIL,
        passwordHash: "$" + faker.internet.password({ length: 10 }),
        providerEmail: loginEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });

      expect(() => credential.updateProviderEmail(null, new Date())).toThrow(
        IdentityError.ProviderEmailRequiredForEmail.code,
      );
    });

    it("throws when the provider email does not match the email subject", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const otherEmail = faker.internet.email().toLowerCase();
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: loginEmail,
        provider: AuthProvider.EMAIL,
        passwordHash: "$" + faker.internet.password({ length: 10 }),
        providerEmail: loginEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });

      expect(() =>
        credential.updateProviderEmail(otherEmail, new Date()),
      ).toThrow(IdentityError.SubjectDoesNotMatchProviderEmail.code);
    });

    it("throws when the credential is deleted", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const persistedAt = new Date();
      const credential = Credential.restore({
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        subject: loginEmail,
        provider: AuthProvider.EMAIL,
        passwordHash: "$" + faker.internet.password({ length: 10 }),
        providerEmail: loginEmail,
        version: 0,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        deletedAt: null,
      });

      credential.markAsDeleted(new Date());

      expect(() =>
        credential.updateProviderEmail(loginEmail, new Date()),
      ).toThrow(IdentityError.CredentialDeleted.code);
    });
  });

  describe("markAsDeleted", () => {
    it("marks the credential as deleted", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const credential = Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: faker.database.mongodbObjectId(),
          subject: loginEmail,
          provider: AuthProvider.EMAIL,
          passwordHash: "$" + faker.internet.password({ length: 10 }),
          providerEmail: loginEmail,
        },
        new Date(),
      );
      const deletedAt = new Date();

      credential.markAsDeleted(deletedAt);

      expect(credential.deletedAt).toBe(deletedAt);
      expect(credential.isDeleted()).toBe(true);
    });

    it("does not overwrite deletedAt when the credential is already deleted", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const credential = Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: faker.database.mongodbObjectId(),
          subject: loginEmail,
          provider: AuthProvider.EMAIL,
          passwordHash: "$" + faker.internet.password({ length: 10 }),
          providerEmail: loginEmail,
        },
        new Date(),
      );
      const firstDeletedAt = new Date();
      const laterDeletedAt = new Date();

      credential.markAsDeleted(firstDeletedAt);
      credential.markAsDeleted(laterDeletedAt);

      expect(credential.deletedAt).toBe(firstDeletedAt);
    });
  });

  describe("reactivate", () => {
    it("keeps the credential active when it was never deleted", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const credential = Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: faker.database.mongodbObjectId(),
          subject: loginEmail,
          provider: AuthProvider.EMAIL,
          passwordHash: "$" + faker.internet.password({ length: 10 }),
          providerEmail: loginEmail,
        },
        new Date(),
      );

      credential.reactivate(new Date());

      expect(credential.deletedAt).toBeNull();
      expect(credential.isDeleted()).toBe(false);
    });

    it("clears deletedAt when the credential is deleted", () => {
      const loginEmail = faker.internet.email().toLowerCase();
      const credential = Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: faker.database.mongodbObjectId(),
          subject: loginEmail,
          provider: AuthProvider.EMAIL,
          passwordHash: "$" + faker.internet.password({ length: 10 }),
          providerEmail: loginEmail,
        },
        new Date(),
      );
      const deletedAt = new Date();
      const reactivatedAt = new Date();

      credential.markAsDeleted(deletedAt);
      credential.reactivate(reactivatedAt);

      expect(credential.isDeleted()).toBe(false);
      expect(credential.deletedAt).toBeNull();
      expect(credential.updatedAt).toBe(reactivatedAt);
    });
  });
});
