import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityError } from "./errors/identity.error";
import {
  Session,
  SessionRegister,
  SessionRevocationReason,
} from "./session.entity";

const laterThan = (date: Date) =>
  faker.date.soon({ refDate: date, days: { min: 1, max: 30 } });

const CREATED_AT = faker.date.recent();
const LATER = laterThan(CREATED_AT);
const EVEN_LATER = laterThan(LATER);
const EXPIRES_AT = laterThan(EVEN_LATER);

const makeSession = (overrides: Partial<SessionRegister> = {}) =>
  Session.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId: faker.database.mongodbObjectId(),
      credentialId: faker.database.mongodbObjectId(),
      membershipId: faker.database.mongodbObjectId(),
      tokenHash: faker.string.alphanumeric(32),
      expiresAt: EXPIRES_AT,
      userAgent: faker.internet.userAgent(),
      ipAddress: faker.internet.ip(),
      ...overrides,
    },
    CREATED_AT,
  );

describe("Session", () => {
  describe("register", () => {
    it("creates an active session at version 0", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const credentialId = faker.database.mongodbObjectId();
      const membershipId = faker.database.mongodbObjectId();
      const tokenHash = faker.string.alphanumeric(32);
      const userAgent = faker.internet.userAgent();
      const ipAddress = faker.internet.ip();

      const session = makeSession({
        id,
        accountId,
        credentialId,
        membershipId,
        tokenHash,
        userAgent,
        ipAddress,
      });

      expect(session.toSnapshot()).toEqual({
        id,
        accountId,
        credentialId,
        membershipId,
        tokenHash,
        expiresAt: EXPIRES_AT,
        userAgent,
        ipAddress,
        version: 0,
        createdAt: CREATED_AT,
        revokedAt: null,
        acceptedByAccountId: null,
        revokedReason: null,
      });
      expect(session.isActive(CREATED_AT)).toBe(true);
    });
  });

  describe("restore", () => {
    it("rebuilds an active session from persisted state", () => {
      const persisted = makeSession().toSnapshot();

      const session = Session.restore(persisted);

      expect(session.toSnapshot()).toEqual(persisted);
    });

    it("rebuilds a revoked session with the account that revoked it", () => {
      const persisted = {
        ...makeSession().toSnapshot(),
        revokedAt: LATER,
        acceptedByAccountId: faker.database.mongodbObjectId(),
        revokedReason: SessionRevocationReason.SECURITY,
      };

      const session = Session.restore(persisted);

      expect(session.toSnapshot()).toEqual(persisted);
      expect(session.isRevoked()).toBe(true);
    });

    it("throws InvalidSessionRevocationReason when the reason is unknown", () => {
      const persisted = {
        ...makeSession().toSnapshot(),
        revokedAt: LATER,
        revokedReason: faker.string.alpha(12) as SessionRevocationReason,
      };

      expect(() => Session.restore(persisted)).toThrow(
        IdentityError.InvalidSessionRevocationReason.code,
      );
    });
  });

  describe("getters", () => {
    it("expose the session state", () => {
      const session = makeSession();
      session.revoke(
        SessionRevocationReason.REPLACED,
        LATER,
        faker.database.mongodbObjectId(),
      );

      expect({
        id: session.id.value,
        accountId: session.accountId.value,
        credentialId: session.credentialId.value,
        membershipId: session.membershipId.value,
        tokenHash: session.tokenHash.value,
        expiresAt: session.expiresAt,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        version: session.version,
        createdAt: session.createdAt,
        revokedAt: session.revokedAt,
        acceptedByAccountId: session.acceptedByAccountId?.value,
        revokedReason: session.revokedReason,
      }).toEqual(session.toSnapshot());
    });
  });

  describe("isActive", () => {
    it("expires exactly at expiresAt", () => {
      const session = makeSession();

      expect(session.isExpired(CREATED_AT)).toBe(false);
      expect(session.isExpired(EXPIRES_AT)).toBe(true);
      expect(session.isActive(EXPIRES_AT)).toBe(false);
    });
  });

  describe("revoke", () => {
    it("records the reason and time without a revoking account", () => {
      const session = makeSession();

      session.revoke(SessionRevocationReason.LOGOUT, LATER);

      expect(session.toSnapshot()).toMatchObject({
        revokedAt: LATER,
        revokedReason: SessionRevocationReason.LOGOUT,
        acceptedByAccountId: null,
      });
      expect(session.isActive(CREATED_AT)).toBe(false);
    });

    it("records the account that revoked it", () => {
      const session = makeSession();
      const adminId = faker.database.mongodbObjectId();

      session.revoke(SessionRevocationReason.REPLACED, LATER, adminId);

      expect(session.toSnapshot()).toMatchObject({
        revokedAt: LATER,
        revokedReason: SessionRevocationReason.REPLACED,
        acceptedByAccountId: adminId,
      });
    });

    it("keeps the first revocation when called twice", () => {
      const session = makeSession();

      session.revoke(SessionRevocationReason.LOGOUT, LATER);
      session.revoke(SessionRevocationReason.SECURITY, EVEN_LATER);

      expect(session.revokedAt).toBe(LATER);
      expect(session.revokedReason).toBe(SessionRevocationReason.LOGOUT);
    });

    it("throws InvalidSessionRevocationReason when the reason is unknown", () => {
      const session = makeSession();

      expect(() =>
        session.revoke(
          faker.string.alpha(12) as SessionRevocationReason,
          LATER,
        ),
      ).toThrow(IdentityError.InvalidSessionRevocationReason.code);
    });
  });

  describe("markAsSaved", () => {
    it("moves the version one step ahead on every save", () => {
      const entity = makeSession();

      entity.markAsSaved();
      const afterFirst = entity.version;
      entity.markAsSaved();

      expect([afterFirst, entity.version]).toStrictEqual([1, 2]);
    });
  });
});
