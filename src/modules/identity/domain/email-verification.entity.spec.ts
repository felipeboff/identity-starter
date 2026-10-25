import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  EmailVerification,
  EmailVerificationRegister,
} from "./email-verification.entity";
import { IdentityError } from "./errors/identity.error";

const laterThan = (date: Date) =>
  faker.date.soon({ refDate: date, days: { min: 1, max: 30 } });

const CREATED_AT = faker.date.recent();
const LATER = laterThan(CREATED_AT);
const EVEN_LATER = laterThan(LATER);
const EXPIRES_AT = laterThan(EVEN_LATER);
const AFTER_EXPIRY = new Date(EXPIRES_AT.getTime() + 1);

const makeVerification = (overrides: Partial<EmailVerificationRegister> = {}) =>
  EmailVerification.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId: faker.database.mongodbObjectId(),
      tokenHash: faker.string.alphanumeric(32),
      expiresAt: EXPIRES_AT,
      ...overrides,
    },
    CREATED_AT,
  );

describe("EmailVerification", () => {
  describe("register", () => {
    it("creates a pending verification at version 0", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const tokenHash = faker.string.alphanumeric(32);

      const verification = makeVerification({ id, accountId, tokenHash });

      expect(verification.toSnapshot()).toEqual({
        id,
        accountId,
        tokenHash,
        expiresAt: EXPIRES_AT,
        version: 0,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        deletedAt: null,
        consumedAt: null,
      });
      expect(verification.isPending(CREATED_AT)).toBe(true);
    });
  });

  describe("restore", () => {
    it("rebuilds a consumed verification from persisted state", () => {
      const persisted = {
        ...makeVerification().toSnapshot(),
        version: 1,
        updatedAt: LATER,
        consumedAt: LATER,
      };

      const verification = EmailVerification.restore(persisted);

      expect(verification.toSnapshot()).toEqual(persisted);
      expect(verification.isConsumed()).toBe(true);
    });

    it("defaults deletedAt and consumedAt to null when they are missing", () => {
      const { deletedAt, consumedAt, ...persisted } =
        makeVerification().toSnapshot();
      void deletedAt;
      void consumedAt;

      const verification = EmailVerification.restore(persisted);

      expect(verification.deletedAt).toBeNull();
      expect(verification.consumedAt).toBeNull();
    });
  });

  describe("getters", () => {
    it("expose the verification state", () => {
      const verification = makeVerification();

      expect({
        id: verification.id.value,
        accountId: verification.accountId.value,
        tokenHash: verification.tokenHash.value,
        expiresAt: verification.expiresAt,
        version: verification.version,
        createdAt: verification.createdAt,
        updatedAt: verification.updatedAt,
        deletedAt: verification.deletedAt,
        consumedAt: verification.consumedAt,
      }).toEqual(verification.toSnapshot());
    });
  });

  describe("isPending", () => {
    it("expires exactly at expiresAt", () => {
      const verification = makeVerification();

      expect(verification.isExpired(CREATED_AT)).toBe(false);
      expect(verification.isExpired(EXPIRES_AT)).toBe(true);
      expect(verification.isPending(EXPIRES_AT)).toBe(false);
    });
  });

  describe("consume", () => {
    it("sets consumedAt and touches updatedAt", () => {
      const verification = makeVerification();

      verification.consume(LATER);

      expect(verification.isConsumed()).toBe(true);
      expect(verification.consumedAt).toBe(LATER);
      expect(verification.updatedAt).toBe(LATER);
      expect(verification.isPending(LATER)).toBe(false);
    });

    it("keeps the first consumedAt when called twice", () => {
      const verification = makeVerification();

      verification.consume(LATER);
      verification.consume(EVEN_LATER);

      expect(verification.consumedAt).toBe(LATER);
    });

    it("throws EmailVerificationDeleted when the verification is deleted", () => {
      const verification = makeVerification();
      verification.markAsDeleted(CREATED_AT);

      expect(() => verification.consume(LATER)).toThrow(
        IdentityError.EmailVerificationDeleted.code,
      );
    });

    it("throws EmailVerificationExpired when the verification is expired", () => {
      const verification = makeVerification();

      expect(() => verification.consume(AFTER_EXPIRY)).toThrow(
        IdentityError.EmailVerificationExpired.code,
      );
    });
  });

  describe("markAsDeleted", () => {
    it("sets deletedAt and touches updatedAt", () => {
      const verification = makeVerification();

      verification.markAsDeleted(LATER);

      expect(verification.isDeleted()).toBe(true);
      expect(verification.deletedAt).toBe(LATER);
      expect(verification.updatedAt).toBe(LATER);
      expect(verification.isPending(CREATED_AT)).toBe(false);
    });

    it("keeps the first deletedAt when called twice", () => {
      const verification = makeVerification();

      verification.markAsDeleted(LATER);
      verification.markAsDeleted(EVEN_LATER);

      expect(verification.deletedAt).toBe(LATER);
    });
  });

  describe("markAsSaved", () => {
    it("moves the version one step ahead on every save", () => {
      const entity = makeVerification();

      entity.markAsSaved();
      const afterFirst = entity.version;
      entity.markAsSaved();

      expect([afterFirst, entity.version]).toStrictEqual([1, 2]);
    });
  });
});
