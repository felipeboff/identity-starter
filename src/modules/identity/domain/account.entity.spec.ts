import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { fakeUuid } from "@shared/testing/uuid";
import { describe, expect, it } from "vitest";

import { Account } from "./account.entity";
import { IdentityError } from "./errors/identity.error";

describe("Account", () => {
  describe("register", () => {
    it("creates an account with the given identity and default state", () => {
      const id = fakeUuid();
      const name = faker.person.fullName();
      const email = faker.internet.email().toLowerCase();
      const createdBy = fakeUuid();
      const registeredAt = new Date();

      const account = Account.register(
        { id, name, email, createdBy },
        registeredAt,
      );

      expect(account.id.value).toBe(id);
      expect(account.name).toBe(name);
      expect(account.email.value).toBe(email);
      expect(account.createdBy.value).toBe(createdBy);
      expect(account.createdAt).toBe(registeredAt);
      expect(account.updatedAt).toBe(registeredAt);
      expect(account.version).toBe(0);
      expect(account.deletedAt).toBeNull();
      expect(account.lastSeenAt).toBeNull();
      expect(account.isDeleted()).toBe(false);
    });
  });

  describe("restore", () => {
    it("rebuilds an account from persisted state", () => {
      const persistedState = {
        id: fakeUuid(),
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        createdBy: fakeUuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 0,
        deletedAt: null,
        lastSeenAt: null,
      };

      const account = Account.restore(persistedState);

      expect(account.id.value).toBe(persistedState.id);
      expect(account.name).toBe(persistedState.name);
      expect(account.email.value).toBe(persistedState.email);
      expect(account.createdBy.value).toBe(persistedState.createdBy);
      expect(account.createdAt).toBe(persistedState.createdAt);
      expect(account.updatedAt).toBe(persistedState.updatedAt);
      expect(account.version).toBe(persistedState.version);
      expect(account.deletedAt).toBeNull();
      expect(account.lastSeenAt).toBeNull();
    });

    it("rebuilds an account with deletion and last seen timestamps", () => {
      const deletedAt = new Date();
      const lastSeenAt = new Date();
      const persistedState = {
        id: fakeUuid(),
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        createdBy: fakeUuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 2,
        deletedAt,
        lastSeenAt,
      };

      const account = Account.restore(persistedState);

      expect(account.deletedAt).toBe(deletedAt);
      expect(account.lastSeenAt).toBe(lastSeenAt);
      expect(account.version).toBe(2);
      expect(account.isDeleted()).toBe(true);
    });

    it("defaults missing deletion and last seen timestamps to null", () => {
      const persistedState = {
        id: fakeUuid(),
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        createdBy: fakeUuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 0,
      };

      const account = Account.restore(persistedState);

      expect(account.deletedAt).toBeNull();
      expect(account.lastSeenAt).toBeNull();
    });
  });

  describe("updateName", () => {
    it("changes the account name", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );
      const updatedName = faker.person.fullName();
      const updatedAt = new Date();

      account.updateName(updatedName, updatedAt);

      expect(account.name).toBe(updatedName);
      expect(account.updatedAt).toBe(updatedAt);
    });

    it("throws when the account is deleted", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );

      account.markAsDeleted(new Date());

      expect(() =>
        account.updateName(faker.person.fullName(), new Date()),
      ).toThrow(AppError);
      expect(() =>
        account.updateName(faker.person.fullName(), new Date()),
      ).toThrow(IdentityError.AccountDeleted.code);
    });
  });

  describe("markAsDeleted", () => {
    it("marks the account as deleted", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );
      const deletedAt = new Date();

      account.markAsDeleted(deletedAt);

      expect(account.deletedAt).toBe(deletedAt);
      expect(account.isDeleted()).toBe(true);
    });

    it("does not overwrite deletedAt when the account is already deleted", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );
      const firstDeletedAt = new Date();
      const laterDeletedAt = new Date();

      account.markAsDeleted(firstDeletedAt);
      expect(account.isDeleted()).toBe(true);

      account.markAsDeleted(laterDeletedAt);
      expect(account.deletedAt).toBe(firstDeletedAt);
    });
  });

  describe("reactivate", () => {
    it("keeps the account active when it was never deleted", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );

      account.reactivate(new Date());

      expect(account.deletedAt).toBeNull();
      expect(account.isDeleted()).toBe(false);
    });

    it("clears deletedAt when the account is deleted", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );
      const deletedAt = new Date();
      const reactivatedAt = new Date();

      account.markAsDeleted(deletedAt);
      expect(account.isDeleted()).toBe(true);
      expect(account.deletedAt).toBe(deletedAt);

      account.reactivate(reactivatedAt);
      expect(account.isDeleted()).toBe(false);
      expect(account.deletedAt).toBeNull();
    });
  });

  describe("toSnapshot", () => {
    it("returns a snapshot of the current account state", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );

      const snapshot = account.toSnapshot();

      expect(snapshot.id).toBe(account.id.value);
      expect(snapshot.name).toBe(account.name);
      expect(snapshot.email).toBe(account.email.value);
      expect(snapshot.createdBy).toBe(account.createdBy.value);
      expect(snapshot.createdAt).toBe(account.createdAt);
      expect(snapshot.updatedAt).toBe(account.updatedAt);
      expect(snapshot.version).toBe(account.version);
      expect(snapshot.deletedAt).toBe(account.deletedAt);
      expect(snapshot.lastSeenAt).toBe(account.lastSeenAt);
    });
  });

  describe("markAsLastSeen", () => {
    it("records the last seen timestamp", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );
      const lastSeenAt = new Date();

      account.markAsLastSeen(lastSeenAt);

      expect(account.lastSeenAt).toBe(lastSeenAt);
    });

    it("throws when the account is deleted", () => {
      const account = Account.register(
        {
          id: fakeUuid(),
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          createdBy: fakeUuid(),
        },
        new Date(),
      );
      const lastSeenAt = new Date();
      const deletedAt = new Date();

      account.markAsLastSeen(lastSeenAt);
      expect(account.lastSeenAt).toBe(lastSeenAt);

      account.markAsDeleted(deletedAt);
      expect(account.isDeleted()).toBe(true);
      expect(account.deletedAt).toBe(deletedAt);

      expect(() => account.markAsLastSeen(new Date())).toThrow(AppError);
      expect(() => account.markAsLastSeen(new Date())).toThrow(
        IdentityError.AccountDeleted.code,
      );
    });
  });
});
