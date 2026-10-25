import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  AuthProvider,
  Credential,
  CredentialRegisterEmail,
  CredentialRegisterOAuth,
} from "./credential.entity";
import { IdentityError } from "./errors/identity.error";

const CREATED_AT = faker.date.past();
const LATER = faker.date.soon({ refDate: CREATED_AT });
const EVEN_LATER = faker.date.soon({ refDate: LATER });

const fakeEmail = () => faker.internet.email().toLowerCase();
/** PasswordHash only accepts values that start with `$`. */
const fakePasswordHash = () => `$${faker.string.alphanumeric(40)}`;
const fakeOAuthSubject = () => faker.string.numeric(21);

const makeEmailCredential = (
  overrides: Partial<CredentialRegisterEmail> = {},
) => {
  const email = fakeEmail();
  return Credential.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId: faker.database.mongodbObjectId(),
      provider: AuthProvider.EMAIL,
      subject: email,
      providerEmail: email,
      passwordHash: fakePasswordHash(),
      ...overrides,
    },
    CREATED_AT,
  );
};

const makeOAuthCredential = (
  overrides: Partial<CredentialRegisterOAuth> = {},
) =>
  Credential.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId: faker.database.mongodbObjectId(),
      provider: AuthProvider.GOOGLE,
      subject: fakeOAuthSubject(),
      ...overrides,
    },
    CREATED_AT,
  );

const makeDeletedEmailCredential = () => {
  const credential = makeEmailCredential();
  credential.markAsDeleted(CREATED_AT);
  return credential;
};

describe("Credential", () => {
  describe("register", () => {
    it("creates an e-mail credential with a password hash", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const email = fakeEmail();
      const passwordHash = fakePasswordHash();

      const credential = makeEmailCredential({
        id,
        accountId,
        subject: email,
        providerEmail: email,
        passwordHash,
      });

      expect(credential.toSnapshot()).toEqual({
        id,
        accountId,
        provider: AuthProvider.EMAIL,
        subject: email,
        providerEmail: email,
        passwordHash,
        version: 0,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        deletedAt: null,
      });
      expect(credential.isDeleted()).toBe(false);
    });

    it("creates an OAuth credential without password hash or provider e-mail", () => {
      const subject = fakeOAuthSubject();

      const credential = makeOAuthCredential({ subject });

      expect(credential.toSnapshot()).toMatchObject({
        provider: AuthProvider.GOOGLE,
        subject,
        passwordHash: null,
        providerEmail: null,
      });
    });

    it("creates an OAuth credential with a provider e-mail", () => {
      const providerEmail = fakeEmail();

      const credential = makeOAuthCredential({ providerEmail });

      expect(credential.providerEmail?.value).toBe(providerEmail);
      expect(credential.toSnapshot().providerEmail).toBe(providerEmail);
    });

    it("throws ProviderEmailRequiredForEmail when an e-mail credential has no provider e-mail", () => {
      expect(() =>
        makeEmailCredential({ providerEmail: null as never }),
      ).toThrow(IdentityError.ProviderEmailRequiredForEmail.code);
    });

    it("throws SubjectDoesNotMatchProviderEmail when the e-mails differ", () => {
      expect(() =>
        makeEmailCredential({
          subject: fakeEmail(),
          providerEmail: fakeEmail(),
        }),
      ).toThrow(IdentityError.SubjectDoesNotMatchProviderEmail.code);
    });
  });

  describe("restore", () => {
    const email = fakeEmail();

    it.each([
      [
        "an e-mail credential",
        {
          provider: AuthProvider.EMAIL,
          subject: email,
          providerEmail: email,
          passwordHash: fakePasswordHash(),
        },
      ],
      [
        "an OAuth credential without provider e-mail",
        {
          provider: AuthProvider.GITHUB,
          subject: fakeOAuthSubject(),
          providerEmail: null,
          passwordHash: null,
        },
      ],
      [
        "an OAuth credential with provider e-mail",
        {
          provider: AuthProvider.APPLE,
          subject: fakeOAuthSubject(),
          providerEmail: fakeEmail(),
          passwordHash: null,
        },
      ],
    ] as const)("rebuilds %s from persisted state", (_, fields) => {
      const persisted = {
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        ...fields,
        version: faker.number.int({ min: 1, max: 10 }),
        createdAt: CREATED_AT,
        updatedAt: LATER,
        deletedAt: null,
      };

      const credential = Credential.restore(persisted);

      expect(credential.toSnapshot()).toEqual(persisted);
    });
  });

  describe("getters", () => {
    it("expose the credential state", () => {
      const credential = makeEmailCredential();

      expect({
        id: credential.id.value,
        accountId: credential.accountId.value,
        provider: credential.provider,
        subject: credential.subjectValue(),
        providerEmail: credential.providerEmail?.value,
        passwordHash: credential.passwordHash?.value,
        version: credential.version,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
        deletedAt: credential.deletedAt,
      }).toEqual(credential.toSnapshot());
    });

    it("keeps the e-mail subject as an Email and the OAuth subject as a string", () => {
      const email = fakeEmail();
      const oauthSubject = fakeOAuthSubject();

      const emailCredential = makeEmailCredential({
        subject: email,
        providerEmail: email,
      });
      const oauthCredential = makeOAuthCredential({ subject: oauthSubject });

      expect(emailCredential.subject).not.toBe(email);
      expect(emailCredential.subjectValue()).toBe(email);
      expect(oauthCredential.subject).toBe(oauthSubject);
      expect(oauthCredential.subjectValue()).toBe(oauthSubject);
    });
  });

  describe("updatePasswordHash", () => {
    it("replaces the hash and touches updatedAt", () => {
      const credential = makeEmailCredential();
      const newHash = fakePasswordHash();

      credential.updatePasswordHash(newHash, LATER);

      expect(credential.passwordHash?.value).toBe(newHash);
      expect(credential.updatedAt).toBe(LATER);
    });

    it("throws PasswordHashNotAllowedForProvider for an OAuth credential", () => {
      const credential = makeOAuthCredential();

      expect(() =>
        credential.updatePasswordHash(fakePasswordHash(), LATER),
      ).toThrow(IdentityError.PasswordHashNotAllowedForProvider.code);
    });

    it("throws CredentialDeleted when the credential is deleted", () => {
      const credential = makeDeletedEmailCredential();

      expect(() =>
        credential.updatePasswordHash(fakePasswordHash(), LATER),
      ).toThrow(IdentityError.CredentialDeleted.code);
    });
  });

  describe("updateProviderEmail", () => {
    it("accepts the same e-mail on an e-mail credential", () => {
      const credential = makeEmailCredential();
      const sameEmail = credential.subjectValue();

      credential.updateProviderEmail(sameEmail, LATER);

      expect(credential.providerEmail?.value).toBe(sameEmail);
      expect(credential.updatedAt).toBe(LATER);
    });

    it("sets the provider e-mail of an OAuth credential", () => {
      const credential = makeOAuthCredential();
      const providerEmail = fakeEmail();

      credential.updateProviderEmail(providerEmail, LATER);

      expect(credential.providerEmail?.value).toBe(providerEmail);
      expect(credential.updatedAt).toBe(LATER);
    });

    it("clears the provider e-mail of an OAuth credential", () => {
      const credential = makeOAuthCredential({ providerEmail: fakeEmail() });

      credential.updateProviderEmail(null, LATER);

      expect(credential.providerEmail).toBeNull();
    });

    it("throws ProviderEmailRequiredForEmail when clearing an e-mail credential", () => {
      const credential = makeEmailCredential();

      expect(() => credential.updateProviderEmail(null, LATER)).toThrow(
        IdentityError.ProviderEmailRequiredForEmail.code,
      );
    });

    it("throws SubjectDoesNotMatchProviderEmail when the new e-mail differs from the subject", () => {
      const credential = makeEmailCredential();

      expect(() => credential.updateProviderEmail(fakeEmail(), LATER)).toThrow(
        IdentityError.SubjectDoesNotMatchProviderEmail.code,
      );
    });

    it("throws CredentialDeleted when the credential is deleted", () => {
      const credential = makeDeletedEmailCredential();

      expect(() =>
        credential.updateProviderEmail(credential.subjectValue(), LATER),
      ).toThrow(IdentityError.CredentialDeleted.code);
    });
  });

  describe("markAsDeleted", () => {
    it("sets deletedAt and touches updatedAt", () => {
      const credential = makeEmailCredential();

      credential.markAsDeleted(LATER);

      expect(credential.isDeleted()).toBe(true);
      expect(credential.deletedAt).toBe(LATER);
      expect(credential.updatedAt).toBe(LATER);
    });

    it("keeps the first deletedAt when called twice", () => {
      const credential = makeEmailCredential();

      credential.markAsDeleted(LATER);
      credential.markAsDeleted(EVEN_LATER);

      expect(credential.deletedAt).toBe(LATER);
    });
  });

  describe("reactivate", () => {
    it("clears deletedAt and touches updatedAt", () => {
      const credential = makeDeletedEmailCredential();

      credential.reactivate(LATER);

      expect(credential.isDeleted()).toBe(false);
      expect(credential.deletedAt).toBeNull();
      expect(credential.updatedAt).toBe(LATER);
    });

    it("does nothing when the credential is active", () => {
      const credential = makeEmailCredential();

      credential.reactivate(LATER);

      expect(credential.deletedAt).toBeNull();
      expect(credential.updatedAt).toBe(CREATED_AT);
    });
  });

  describe("markAsSaved", () => {
    it("moves the version one step ahead on every save", () => {
      const entity = makeEmailCredential();

      entity.markAsSaved();
      const afterFirst = entity.version;
      entity.markAsSaved();

      expect([afterFirst, entity.version]).toStrictEqual([1, 2]);
    });
  });
});
