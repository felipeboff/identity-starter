import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { fakeUuid } from "@shared/testing/uuid";
import { describe, expect, it } from "vitest";

import { IdentityError } from "./errors/identity.error";
import { Session, SessionRevocationReason } from "./session.entity";

describe("Session", () => {
  describe("register", () => {
    it("creates a session with the given identity and default state", () => {
      const id = fakeUuid();
      const accountId = fakeUuid();
      const credentialId = fakeUuid();
      const membershipId = fakeUuid();
      const tokenHash = faker.string.alphanumeric(32);
      const userAgent = faker.internet.userAgent();
      const ipAddress = faker.internet.ip();
      const registeredAt = new Date();
      const expiresAt = new Date(registeredAt.getTime() + 60_000);

      const session = Session.register(
        {
          id,
          accountId,
          credentialId,
          membershipId,
          tokenHash,
          expiresAt,
          userAgent,
          ipAddress,
        },
        registeredAt,
      );

      expect(session.id.value).toBe(id);
      expect(session.accountId.value).toBe(accountId);
      expect(session.credentialId.value).toBe(credentialId);
      expect(session.membershipId.value).toBe(membershipId);
      expect(session.tokenHash.value).toBe(tokenHash);
      expect(session.expiresAt).toBe(expiresAt);
      expect(session.userAgent).toBe(userAgent);
      expect(session.ipAddress).toBe(ipAddress);
      expect(session.version).toBe(0);
      expect(session.createdAt).toBe(registeredAt);
      expect(session.revokedAt).toBeNull();
      expect(session.acceptedByAccountId).toBeNull();
      expect(session.revokedReason).toBeNull();
      expect(session.isRevoked()).toBe(false);
      expect(session.isActive(registeredAt)).toBe(true);
    });
  });

  describe("restore", () => {
    it("rebuilds an active session from persisted state", () => {
      const persistedAt = new Date();
      const persistedState = {
        id: fakeUuid(),
        accountId: fakeUuid(),
        credentialId: fakeUuid(),
        membershipId: fakeUuid(),
        tokenHash: faker.string.alphanumeric(32),
        expiresAt: new Date(persistedAt.getTime() + 60_000),
        userAgent: faker.internet.userAgent(),
        ipAddress: faker.internet.ip(),
        createdAt: persistedAt,
        version: 1,
        revokedAt: null,
        acceptedByAccountId: null,
        revokedReason: null,
      };

      const session = Session.restore(persistedState);

      expect(session.toSnapshot()).toEqual(persistedState);
    });

    it("rebuilds a revoked session with the account that revoked it", () => {
      const acceptedByAccountId = fakeUuid();
      const revokedAt = new Date();
      const session = Session.restore({
        id: fakeUuid(),
        accountId: fakeUuid(),
        credentialId: fakeUuid(),
        membershipId: fakeUuid(),
        tokenHash: faker.string.alphanumeric(32),
        expiresAt: new Date(revokedAt.getTime() + 60_000),
        userAgent: faker.internet.userAgent(),
        ipAddress: faker.internet.ip(),
        createdAt: revokedAt,
        version: 1,
        revokedAt,
        acceptedByAccountId,
        revokedReason: SessionRevocationReason.SECURITY,
      });

      expect(session.isRevoked()).toBe(true);
      expect(session.revokedAt).toBe(revokedAt);
      expect(session.acceptedByAccountId?.value).toBe(acceptedByAccountId);
      expect(session.revokedReason).toBe(SessionRevocationReason.SECURITY);
      expect(session.toSnapshot().acceptedByAccountId).toBe(
        acceptedByAccountId,
      );
    });

    it("throws when the revocation reason is invalid", () => {
      expect(() =>
        Session.restore({
          id: fakeUuid(),
          accountId: fakeUuid(),
          credentialId: fakeUuid(),
          membershipId: fakeUuid(),
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(),
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ip(),
          createdAt: new Date(),
          version: 1,
          revokedAt: new Date(),
          acceptedByAccountId: null,
          revokedReason: "unknown" as SessionRevocationReason,
        }),
      ).toThrow(IdentityError.InvalidSessionRevocationReason.code);
    });
  });

  describe("toSnapshot", () => {
    it("returns a snapshot of the current session state", () => {
      const session = Session.register(
        {
          id: fakeUuid(),
          accountId: fakeUuid(),
          credentialId: fakeUuid(),
          membershipId: fakeUuid(),
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(),
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ip(),
        },
        new Date(),
      );

      const snapshot = session.toSnapshot();

      expect(snapshot.id).toBe(session.id.value);
      expect(snapshot.accountId).toBe(session.accountId.value);
      expect(snapshot.credentialId).toBe(session.credentialId.value);
      expect(snapshot.membershipId).toBe(session.membershipId.value);
      expect(snapshot.tokenHash).toBe(session.tokenHash.value);
      expect(snapshot.expiresAt).toBe(session.expiresAt);
      expect(snapshot.userAgent).toBe(session.userAgent);
      expect(snapshot.ipAddress).toBe(session.ipAddress);
      expect(snapshot.version).toBe(session.version);
      expect(snapshot.createdAt).toBe(session.createdAt);
      expect(snapshot.revokedAt).toBe(session.revokedAt);
      expect(snapshot.acceptedByAccountId).toBeNull();
      expect(snapshot.revokedReason).toBe(session.revokedReason);
    });
  });

  describe("isExpired", () => {
    it("considers the session expired at the expiration time", () => {
      const registeredAt = new Date();
      const expiresAt = new Date(registeredAt.getTime() + 60_000);
      const session = Session.register(
        {
          id: fakeUuid(),
          accountId: fakeUuid(),
          credentialId: fakeUuid(),
          membershipId: fakeUuid(),
          tokenHash: faker.string.alphanumeric(32),
          expiresAt,
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ip(),
        },
        registeredAt,
      );

      expect(session.isExpired(registeredAt)).toBe(false);
      expect(session.isExpired(expiresAt)).toBe(true);
      expect(session.isActive(expiresAt)).toBe(false);
    });
  });

  describe("revoke", () => {
    it("revokes an active session without an accepting account", () => {
      const registeredAt = new Date();
      const session = Session.register(
        {
          id: fakeUuid(),
          accountId: fakeUuid(),
          credentialId: fakeUuid(),
          membershipId: fakeUuid(),
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ip(),
        },
        registeredAt,
      );
      const revokedAt = new Date();

      session.revoke(SessionRevocationReason.LOGOUT, revokedAt);

      expect(session.isRevoked()).toBe(true);
      expect(session.revokedAt).toBe(revokedAt);
      expect(session.revokedReason).toBe(SessionRevocationReason.LOGOUT);
      expect(session.acceptedByAccountId).toBeNull();
      expect(session.isActive(registeredAt)).toBe(false);
    });

    it("revokes an active session with the account that revoked it", () => {
      const registeredAt = new Date();
      const session = Session.register(
        {
          id: fakeUuid(),
          accountId: fakeUuid(),
          credentialId: fakeUuid(),
          membershipId: fakeUuid(),
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ip(),
        },
        registeredAt,
      );
      const acceptedByAccountId = fakeUuid();
      const revokedAt = new Date();

      session.revoke(
        SessionRevocationReason.REPLACED,
        revokedAt,
        acceptedByAccountId,
      );

      expect(session.revokedReason).toBe(SessionRevocationReason.REPLACED);
      expect(session.acceptedByAccountId?.value).toBe(acceptedByAccountId);
      expect(session.revokedAt).toBe(revokedAt);
    });

    it("does not overwrite revocation data when the session is already revoked", () => {
      const registeredAt = new Date();
      const session = Session.register(
        {
          id: fakeUuid(),
          accountId: fakeUuid(),
          credentialId: fakeUuid(),
          membershipId: fakeUuid(),
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ip(),
        },
        registeredAt,
      );
      const firstRevokedAt = new Date();
      const laterRevokedAt = new Date();

      session.revoke(SessionRevocationReason.LOGOUT, firstRevokedAt);
      session.revoke(SessionRevocationReason.SECURITY, laterRevokedAt);

      expect(session.revokedAt).toBe(firstRevokedAt);
      expect(session.revokedReason).toBe(SessionRevocationReason.LOGOUT);
    });

    it("throws when the revocation reason is invalid", () => {
      const registeredAt = new Date();
      const session = Session.register(
        {
          id: fakeUuid(),
          accountId: fakeUuid(),
          credentialId: fakeUuid(),
          membershipId: fakeUuid(),
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          userAgent: faker.internet.userAgent(),
          ipAddress: faker.internet.ip(),
        },
        registeredAt,
      );

      expect(() =>
        session.revoke("unknown" as SessionRevocationReason, new Date()),
      ).toThrow(AppError);
      expect(() =>
        session.revoke("unknown" as SessionRevocationReason, new Date()),
      ).toThrow(IdentityError.InvalidSessionRevocationReason.code);
    });
  });
});
