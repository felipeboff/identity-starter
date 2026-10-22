import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityError } from "./errors/identity.error";
import { PasswordReset, PasswordResetRegister } from "./password-reset.entity";

const laterThan = (date: Date) =>
  faker.date.soon({ refDate: date, days: { min: 1, max: 30 } });

const CREATED_AT = faker.date.recent();
const LATER = laterThan(CREATED_AT);
const EVEN_LATER = laterThan(LATER);
const EXPIRES_AT = laterThan(EVEN_LATER);
const AFTER_EXPIRY = new Date(EXPIRES_AT.getTime() + 1);

const makePasswordReset = (overrides: Partial<PasswordResetRegister> = {}) =>
  PasswordReset.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId: faker.database.mongodbObjectId(),
      credentialId: faker.database.mongodbObjectId(),
      tokenHash: faker.string.alphanumeric(32),
      expiresAt: EXPIRES_AT,
      ...overrides,
    },
    CREATED_AT,
  );

describe("PasswordReset", () => {
  describe("register", () => {
    it("creates a pending reset at version 0", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const credentialId = faker.database.mongodbObjectId();
      const tokenHash = faker.string.alphanumeric(32);

      const reset = makePasswordReset({
        id,
        accountId,
        credentialId,
        tokenHash,
      });

      expect(reset.toSnapshot()).toEqual({
        id,
        accountId,
        credentialId,
        tokenHash,
        expiresAt: EXPIRES_AT,
        version: 0,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        deletedAt: null,
        consumedAt: null,
      });
      expect(reset.isPending(CREATED_AT)).toBe(true);
    });
  });

  describe("restore", () => {
    it("rebuilds a consumed reset from persisted state", () => {
      const persisted = {
        ...makePasswordReset().toSnapshot(),
        version: 1,
        updatedAt: LATER,
        consumedAt: LATER,
      };

      const reset = PasswordReset.restore(persisted);

      expect(reset.toSnapshot()).toEqual(persisted);
      expect(reset.isConsumed()).toBe(true);
    });

    it("defaults deletedAt and consumedAt to null when they are missing", () => {
      const { deletedAt, consumedAt, ...persisted } =
        makePasswordReset().toSnapshot();
      void deletedAt;
      void consumedAt;

      const reset = PasswordReset.restore(persisted);

      expect(reset.deletedAt).toBeNull();
      expect(reset.consumedAt).toBeNull();
    });
  });

  describe("getters", () => {
    it("expose the reset state", () => {
      const reset = makePasswordReset();

      expect({
        id: reset.id.value,
        accountId: reset.accountId.value,
        credentialId: reset.credentialId.value,
        tokenHash: reset.tokenHash.value,
        expiresAt: reset.expiresAt,
        version: reset.version,
        createdAt: reset.createdAt,
        updatedAt: reset.updatedAt,
        deletedAt: reset.deletedAt,
        consumedAt: reset.consumedAt,
      }).toEqual(reset.toSnapshot());
    });
  });

  describe("isPending", () => {
    it("expires exactly at expiresAt", () => {
      const reset = makePasswordReset();

      expect(reset.isExpired(CREATED_AT)).toBe(false);
      expect(reset.isExpired(EXPIRES_AT)).toBe(true);
      expect(reset.isPending(EXPIRES_AT)).toBe(false);
    });
  });

  describe("consume", () => {
    it("sets consumedAt and touches updatedAt", () => {
      const reset = makePasswordReset();

      reset.consume(LATER);

      expect(reset.isConsumed()).toBe(true);
      expect(reset.consumedAt).toBe(LATER);
      expect(reset.updatedAt).toBe(LATER);
      expect(reset.isPending(LATER)).toBe(false);
    });

    it("keeps the first consumedAt when called twice", () => {
      const reset = makePasswordReset();

      reset.consume(LATER);
      reset.consume(EVEN_LATER);

      expect(reset.consumedAt).toBe(LATER);
    });

    it("throws PasswordResetDeleted when the reset is deleted", () => {
      const reset = makePasswordReset();
      reset.markAsDeleted(CREATED_AT);

      expect(() => reset.consume(LATER)).toThrow(
        IdentityError.PasswordResetDeleted.code,
      );
    });

    it("throws PasswordResetExpired when the reset is expired", () => {
      const reset = makePasswordReset();

      expect(() => reset.consume(AFTER_EXPIRY)).toThrow(
        IdentityError.PasswordResetExpired.code,
      );
    });
  });

  describe("markAsDeleted", () => {
    it("sets deletedAt and touches updatedAt", () => {
      const reset = makePasswordReset();

      reset.markAsDeleted(LATER);

      expect(reset.isDeleted()).toBe(true);
      expect(reset.deletedAt).toBe(LATER);
      expect(reset.updatedAt).toBe(LATER);
      expect(reset.isPending(CREATED_AT)).toBe(false);
    });

    it("keeps the first deletedAt when called twice", () => {
      const reset = makePasswordReset();

      reset.markAsDeleted(LATER);
      reset.markAsDeleted(EVEN_LATER);

      expect(reset.deletedAt).toBe(LATER);
    });
  });
});
