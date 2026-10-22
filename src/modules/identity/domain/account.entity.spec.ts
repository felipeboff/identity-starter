import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { Account, AccountRegister } from "./account.entity";
import { IdentityError } from "./errors/identity.error";

const CREATED_AT = faker.date.past();
const LATER = faker.date.soon({ refDate: CREATED_AT });
const EVEN_LATER = faker.date.soon({ refDate: LATER });

const makeAccount = (overrides: Partial<AccountRegister> = {}) =>
  Account.register(
    {
      id: faker.database.mongodbObjectId(),
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      createdBy: faker.database.mongodbObjectId(),
      ...overrides,
    },
    CREATED_AT,
  );

const makeDeletedAccount = () => {
  const account = makeAccount();
  account.markAsDeleted(CREATED_AT);
  return account;
};

describe("Account", () => {
  describe("register", () => {
    it("creates an active, unverified account at version 0", () => {
      const id = faker.database.mongodbObjectId();
      const name = faker.person.fullName();
      const email = faker.internet.email().toLowerCase();
      const createdBy = faker.database.mongodbObjectId();

      const account = makeAccount({ id, name, email, createdBy });

      expect(account.toSnapshot()).toEqual({
        id,
        name,
        email,
        createdBy,
        version: 0,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        deletedAt: null,
        lastSeenAt: null,
        emailVerifiedAt: null,
      });
      expect(account.isDeleted()).toBe(false);
      expect(account.isEmailVerified()).toBe(false);
    });
  });

  describe("restore", () => {
    it("rebuilds the account from persisted state", () => {
      const persisted = {
        id: faker.database.mongodbObjectId(),
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        createdBy: faker.database.mongodbObjectId(),
        version: faker.number.int({ min: 1, max: 10 }),
        createdAt: CREATED_AT,
        updatedAt: EVEN_LATER,
        deletedAt: EVEN_LATER,
        lastSeenAt: LATER,
        emailVerifiedAt: LATER,
      };

      const account = Account.restore(persisted);

      expect(account.toSnapshot()).toEqual(persisted);
      expect(account.isDeleted()).toBe(true);
      expect(account.isEmailVerified()).toBe(true);
    });

    it("defaults missing optional timestamps to null", () => {
      const account = Account.restore({
        id: faker.database.mongodbObjectId(),
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        createdBy: faker.database.mongodbObjectId(),
        version: 0,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      });

      expect(account.toSnapshot()).toMatchObject({
        deletedAt: null,
        lastSeenAt: null,
        emailVerifiedAt: null,
      });
    });
  });

  describe("getters", () => {
    it("expose the account state", () => {
      const account = makeAccount();

      expect({
        id: account.id.value,
        name: account.name,
        email: account.email.value,
        createdBy: account.createdBy.value,
        version: account.version,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        deletedAt: account.deletedAt,
        lastSeenAt: account.lastSeenAt,
        emailVerifiedAt: account.emailVerifiedAt,
      }).toEqual(account.toSnapshot());
    });
  });

  describe("updateName", () => {
    it("changes the name and touches updatedAt", () => {
      const account = makeAccount();
      const newName = faker.person.fullName();

      account.updateName(newName, LATER);

      expect(account.name).toBe(newName);
      expect(account.updatedAt).toBe(LATER);
    });

    it("throws AccountDeleted when the account is deleted", () => {
      const account = makeDeletedAccount();

      expect(() => account.updateName(faker.person.fullName(), LATER)).toThrow(
        IdentityError.AccountDeleted.code,
      );
    });
  });

  describe("markAsLastSeen", () => {
    it("records the last seen timestamp and touches updatedAt", () => {
      const account = makeAccount();

      account.markAsLastSeen(LATER);

      expect(account.lastSeenAt).toBe(LATER);
      expect(account.updatedAt).toBe(LATER);
    });

    it("throws AccountDeleted when the account is deleted", () => {
      const account = makeDeletedAccount();

      expect(() => account.markAsLastSeen(LATER)).toThrow(
        IdentityError.AccountDeleted.code,
      );
    });
  });

  describe("markEmailAsVerified", () => {
    it("records the verification timestamp and touches updatedAt", () => {
      const account = makeAccount();

      account.markEmailAsVerified(LATER);

      expect(account.isEmailVerified()).toBe(true);
      expect(account.emailVerifiedAt).toBe(LATER);
      expect(account.updatedAt).toBe(LATER);
    });

    it("keeps the first verification timestamp when called twice", () => {
      const account = makeAccount();

      account.markEmailAsVerified(LATER);
      account.markEmailAsVerified(EVEN_LATER);

      expect(account.emailVerifiedAt).toBe(LATER);
      expect(account.updatedAt).toBe(LATER);
    });

    it("throws AccountDeleted when the account is deleted", () => {
      const account = makeDeletedAccount();

      expect(() => account.markEmailAsVerified(LATER)).toThrow(
        IdentityError.AccountDeleted.code,
      );
    });
  });

  describe("markAsDeleted", () => {
    it("sets deletedAt and touches updatedAt", () => {
      const account = makeAccount();

      account.markAsDeleted(LATER);

      expect(account.isDeleted()).toBe(true);
      expect(account.deletedAt).toBe(LATER);
      expect(account.updatedAt).toBe(LATER);
    });

    it("keeps the first deletedAt when called twice", () => {
      const account = makeAccount();

      account.markAsDeleted(LATER);
      account.markAsDeleted(EVEN_LATER);

      expect(account.deletedAt).toBe(LATER);
    });
  });

  describe("reactivate", () => {
    it("clears deletedAt and touches updatedAt", () => {
      const account = makeDeletedAccount();

      account.reactivate(LATER);

      expect(account.isDeleted()).toBe(false);
      expect(account.deletedAt).toBeNull();
      expect(account.updatedAt).toBe(LATER);
    });

    it("does nothing when the account is active", () => {
      const account = makeAccount();

      account.reactivate(LATER);

      expect(account.deletedAt).toBeNull();
      expect(account.updatedAt).toBe(CREATED_AT);
    });
  });
});
