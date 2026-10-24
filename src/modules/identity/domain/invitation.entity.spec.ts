import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityError } from "./errors/identity.error";
import { Invitation, InvitationRegister } from "./invitation.entity";
import { MembershipPermission, MembershipRole } from "./membership.entity";

const laterThan = (date: Date) =>
  faker.date.soon({ refDate: date, days: { min: 1, max: 30 } });

const CREATED_AT = faker.date.recent();
const LATER = laterThan(CREATED_AT);
const EVEN_LATER = laterThan(LATER);
const EXPIRES_AT = laterThan(EVEN_LATER);
const AFTER_EXPIRY = laterThan(EXPIRES_AT);

const makeInvitation = (overrides: Partial<InvitationRegister> = {}) =>
  Invitation.register(
    {
      id: faker.database.mongodbObjectId(),
      email: faker.internet.email().toLowerCase(),
      role: MembershipRole.USER,
      permissions: [MembershipPermission.READ],
      tokenHash: faker.string.alphanumeric(32),
      expiresAt: EXPIRES_AT,
      createdBy: faker.database.mongodbObjectId(),
      ...overrides,
    },
    CREATED_AT,
  );

const makeAcceptedInvitation = () => {
  const invitation = makeInvitation();
  invitation.accept(faker.database.mongodbObjectId(), CREATED_AT);
  return invitation;
};

const makeRevokedInvitation = () => {
  const invitation = makeInvitation();
  invitation.revoke(CREATED_AT);
  return invitation;
};

describe("Invitation", () => {
  describe("register", () => {
    it("creates a pending invitation at version 0", () => {
      const id = faker.database.mongodbObjectId();
      const createdBy = faker.database.mongodbObjectId();
      const email = faker.internet.email().toLowerCase();
      const tokenHash = faker.string.alphanumeric(32);

      const invitation = makeInvitation({ id, createdBy, email, tokenHash });

      expect(invitation.toSnapshot()).toEqual({
        id,
        email,
        role: MembershipRole.USER,
        permissions: [MembershipPermission.READ],
        tokenHash,
        expiresAt: EXPIRES_AT,
        createdBy,
        version: 0,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        acceptedAt: null,
        acceptedByAccountId: null,
        revokedAt: null,
      });
      expect(invitation.isPending(CREATED_AT)).toBe(true);
    });

    it("throws InvalidMembershipRole when the role is unknown", () => {
      expect(() =>
        makeInvitation({ role: faker.string.alpha(12) as MembershipRole }),
      ).toThrow(IdentityError.InvalidMembershipRole.code);
    });

    it("throws InvalidMembershipPermissions when a permission is unknown", () => {
      expect(() =>
        makeInvitation({
          permissions: [faker.string.alpha(12) as MembershipPermission],
        }),
      ).toThrow(IdentityError.InvalidMembershipPermissions.code);
    });
  });

  describe("restore", () => {
    it("rebuilds a pending invitation from persisted state", () => {
      const persisted = {
        id: faker.database.mongodbObjectId(),
        email: faker.internet.email().toLowerCase(),
        role: MembershipRole.ADMIN,
        permissions: [MembershipPermission.ADMIN],
        tokenHash: faker.string.alphanumeric(32),
        expiresAt: EXPIRES_AT,
        createdBy: faker.database.mongodbObjectId(),
        version: 1,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        acceptedAt: null,
        acceptedByAccountId: null,
        revokedAt: null,
      };

      const invitation = Invitation.restore(persisted);

      expect(invitation.toSnapshot()).toEqual(persisted);
    });

    it("rebuilds an accepted invitation with the accepting account", () => {
      const persisted = {
        ...makeInvitation().toSnapshot(),
        acceptedAt: LATER,
        acceptedByAccountId: faker.database.mongodbObjectId(),
      };

      const invitation = Invitation.restore(persisted);

      expect(invitation.toSnapshot()).toEqual(persisted);
      expect(invitation.isAccepted()).toBe(true);
    });
  });

  describe("getters", () => {
    it("expose the invitation state", () => {
      const invitation = makeAcceptedInvitation();
      const snapshot = invitation.toSnapshot();

      expect({
        id: invitation.id.value,
        email: invitation.email.value,
        role: invitation.role,
        permissions: invitation.permissions,
        tokenHash: invitation.tokenHash.value,
        expiresAt: invitation.expiresAt,
        createdBy: invitation.createdBy.value,
        version: invitation.version,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
        acceptedAt: invitation.acceptedAt,
        acceptedByAccountId: invitation.acceptedByAccountId?.value,
        revokedAt: invitation.revokedAt,
      }).toEqual(snapshot);
    });

    it("return copies of the permissions so callers cannot mutate them", () => {
      const invitation = makeInvitation();

      invitation.permissions.push(MembershipPermission.ADMIN);
      invitation.toSnapshot().permissions.push(MembershipPermission.ADMIN);

      expect(invitation.permissions).toEqual([MembershipPermission.READ]);
    });
  });

  describe("isPending", () => {
    it.each([
      ["a new invitation before expiry", true, makeInvitation, CREATED_AT],
      ["a new invitation at expiry", false, makeInvitation, EXPIRES_AT],
      ["an accepted invitation", false, makeAcceptedInvitation, CREATED_AT],
      ["a revoked invitation", false, makeRevokedInvitation, CREATED_AT],
    ])("%s → pending: %s", (_, expected, make, at) => {
      expect(make().isPending(at)).toBe(expected);
    });

    it("expires exactly at expiresAt", () => {
      const invitation = makeInvitation();

      expect(invitation.isExpired(CREATED_AT)).toBe(false);
      expect(invitation.isExpired(EXPIRES_AT)).toBe(true);
    });
  });

  describe("updateRole", () => {
    it("changes the role and touches updatedAt", () => {
      const invitation = makeInvitation({ role: MembershipRole.USER });

      invitation.updateRole(MembershipRole.ADMIN, LATER);

      expect(invitation.role).toBe(MembershipRole.ADMIN);
      expect(invitation.updatedAt).toBe(LATER);
    });

    it("throws InvitationAlreadyAccepted when the invitation is accepted", () => {
      const invitation = makeAcceptedInvitation();

      expect(() => invitation.updateRole(MembershipRole.ADMIN, LATER)).toThrow(
        IdentityError.InvitationAlreadyAccepted.code,
      );
    });

    it("throws InvalidMembershipRole when the role is unknown", () => {
      const invitation = makeInvitation();

      expect(() =>
        invitation.updateRole(faker.string.alpha(12) as MembershipRole, LATER),
      ).toThrow(IdentityError.InvalidMembershipRole.code);
    });
  });

  describe("updatePermissions", () => {
    it("replaces the permissions with a copy and touches updatedAt", () => {
      const invitation = makeInvitation();
      const permissions: MembershipPermission[] = [
        MembershipPermission.READ,
        MembershipPermission.WRITE,
      ];

      invitation.updatePermissions(permissions, LATER);
      permissions.push(MembershipPermission.ADMIN);

      expect(invitation.permissions).toEqual([
        MembershipPermission.READ,
        MembershipPermission.WRITE,
      ]);
      expect(invitation.updatedAt).toBe(LATER);
    });

    it("throws InvitationRevoked when the invitation is revoked", () => {
      const invitation = makeRevokedInvitation();

      expect(() =>
        invitation.updatePermissions([MembershipPermission.WRITE], LATER),
      ).toThrow(IdentityError.InvitationRevoked.code);
    });

    it("throws InvitationExpired when the invitation is expired", () => {
      const invitation = makeInvitation();

      expect(() =>
        invitation.updatePermissions(
          [MembershipPermission.WRITE],
          AFTER_EXPIRY,
        ),
      ).toThrow(IdentityError.InvitationExpired.code);
    });

    it("throws InvalidMembershipPermissions when a permission is unknown", () => {
      const invitation = makeInvitation();

      expect(() =>
        invitation.updatePermissions(
          [faker.string.alpha(12) as MembershipPermission],
          LATER,
        ),
      ).toThrow(IdentityError.InvalidMembershipPermissions.code);
    });
  });

  describe("accept", () => {
    it("records who accepted and when", () => {
      const invitation = makeInvitation();
      const accountId = faker.database.mongodbObjectId();

      invitation.accept(accountId, LATER);

      expect(invitation.isAccepted()).toBe(true);
      expect(invitation.acceptedAt).toBe(LATER);
      expect(invitation.acceptedByAccountId?.value).toBe(accountId);
      expect(invitation.updatedAt).toBe(LATER);
    });

    it("keeps the first acceptance when called twice", () => {
      const invitation = makeInvitation();
      const firstAccountId = faker.database.mongodbObjectId();

      invitation.accept(firstAccountId, LATER);
      invitation.accept(faker.database.mongodbObjectId(), EVEN_LATER);

      expect(invitation.acceptedAt).toBe(LATER);
      expect(invitation.acceptedByAccountId?.value).toBe(firstAccountId);
    });
  });

  describe("revoke", () => {
    it("sets revokedAt and touches updatedAt", () => {
      const invitation = makeInvitation();

      invitation.revoke(LATER);

      expect(invitation.isRevoked()).toBe(true);
      expect(invitation.revokedAt).toBe(LATER);
      expect(invitation.updatedAt).toBe(LATER);
    });

    it("keeps the first revokedAt when called twice", () => {
      const invitation = makeInvitation();

      invitation.revoke(LATER);
      invitation.revoke(EVEN_LATER);

      expect(invitation.revokedAt).toBe(LATER);
    });

    it("throws InvitationAlreadyAccepted when the invitation is accepted", () => {
      const invitation = makeAcceptedInvitation();

      expect(() => invitation.revoke(LATER)).toThrow(
        IdentityError.InvitationAlreadyAccepted.code,
      );
    });
  });
});
