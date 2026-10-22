import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { describe, expect, it } from "vitest";

import { IdentityError } from "./errors/identity.error";
import { Invitation } from "./invitation.entity";
import { MembershipPermission, MembershipRole } from "./membership.entity";

describe("Invitation", () => {
  describe("register", () => {
    it("creates an invitation with the given identity and default state", () => {
      const id = faker.database.mongodbObjectId();
      const email = faker.internet.email().toLowerCase();
      const tokenHash = faker.string.alphanumeric(32);
      const createdBy = faker.database.mongodbObjectId();
      const registeredAt = new Date();
      const expiresAt = new Date(registeredAt.getTime() + 60_000);

      const invitation = Invitation.register(
        {
          id,
          email,
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash,
          expiresAt,
          createdBy,
        },
        registeredAt,
      );

      expect(invitation.id.value).toBe(id);
      expect(invitation.email.value).toBe(email);
      expect(invitation.role).toBe(MembershipRole.USER);
      expect(invitation.permissions).toEqual([MembershipPermission.READ]);
      expect(invitation.tokenHash.value).toBe(tokenHash);
      expect(invitation.expiresAt).toBe(expiresAt);
      expect(invitation.createdBy.value).toBe(createdBy);
      expect(invitation.version).toBe(0);
      expect(invitation.createdAt).toBe(registeredAt);
      expect(invitation.updatedAt).toBe(registeredAt);
      expect(invitation.acceptedAt).toBeNull();
      expect(invitation.acceptedByAccountId).toBeNull();
      expect(invitation.revokedAt).toBeNull();
      expect(invitation.isAccepted()).toBe(false);
      expect(invitation.isRevoked()).toBe(false);
      expect(invitation.isPending(registeredAt)).toBe(true);
    });

    it("throws when the role is invalid", () => {
      expect(() =>
        Invitation.register(
          {
            id: faker.database.mongodbObjectId(),
            email: faker.internet.email().toLowerCase(),
            role: "owner" as MembershipRole,
            permissions: [MembershipPermission.READ],
            tokenHash: faker.string.alphanumeric(32),
            expiresAt: new Date(),
            createdBy: faker.database.mongodbObjectId(),
          },
          new Date(),
        ),
      ).toThrow(IdentityError.InvalidMembershipRole.code);
    });

    it("throws when a permission is invalid", () => {
      expect(() =>
        Invitation.register(
          {
            id: faker.database.mongodbObjectId(),
            email: faker.internet.email().toLowerCase(),
            role: MembershipRole.USER,
            permissions: ["manage" as MembershipPermission],
            tokenHash: faker.string.alphanumeric(32),
            expiresAt: new Date(),
            createdBy: faker.database.mongodbObjectId(),
          },
          new Date(),
        ),
      ).toThrow(IdentityError.InvalidMembershipPermissions.code);
    });
  });

  describe("restore", () => {
    it("rebuilds a pending invitation from persisted state", () => {
      const persistedAt = new Date();
      const persistedState = {
        id: faker.database.mongodbObjectId(),
        email: faker.internet.email().toLowerCase(),
        role: MembershipRole.ADMIN,
        permissions: [MembershipPermission.ADMIN],
        tokenHash: faker.string.alphanumeric(32),
        expiresAt: new Date(persistedAt.getTime() + 60_000),
        createdBy: faker.database.mongodbObjectId(),
        createdAt: persistedAt,
        updatedAt: persistedAt,
        version: 1,
        acceptedAt: null,
        acceptedByAccountId: null,
        revokedAt: null,
      };

      const invitation = Invitation.restore(persistedState);

      expect(invitation.toSnapshot()).toEqual(persistedState);
    });

    it("rebuilds an accepted invitation with the accepting account", () => {
      const acceptedByAccountId = faker.database.mongodbObjectId();
      const acceptedAt = new Date();
      const invitation = Invitation.restore({
        id: faker.database.mongodbObjectId(),
        email: faker.internet.email().toLowerCase(),
        role: MembershipRole.USER,
        permissions: [MembershipPermission.READ],
        tokenHash: faker.string.alphanumeric(32),
        expiresAt: new Date(acceptedAt.getTime() + 60_000),
        createdBy: faker.database.mongodbObjectId(),
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
        version: 1,
        acceptedAt,
        acceptedByAccountId,
        revokedAt: null,
      });

      expect(invitation.isAccepted()).toBe(true);
      expect(invitation.acceptedAt).toBe(acceptedAt);
      expect(invitation.acceptedByAccountId?.value).toBe(acceptedByAccountId);
      expect(invitation.toSnapshot().acceptedByAccountId).toBe(
        acceptedByAccountId,
      );
    });
  });

  describe("toSnapshot", () => {
    it("returns a copy of the invitation permissions", () => {
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ, MembershipPermission.WRITE],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(),
          createdBy: faker.database.mongodbObjectId(),
        },
        new Date(),
      );

      const snapshot = invitation.toSnapshot();

      expect(snapshot.permissions).toEqual(invitation.permissions);
      expect(snapshot.permissions).not.toBe(invitation.permissions);
    });
  });

  describe("isExpired", () => {
    it("considers the invitation expired at the expiration time", () => {
      const registeredAt = new Date();
      const expiresAt = new Date(registeredAt.getTime() + 60_000);
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt,
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );

      expect(invitation.isExpired(registeredAt)).toBe(false);
      expect(invitation.isExpired(expiresAt)).toBe(true);
    });
  });

  describe("isPending", () => {
    it("is not pending when the invitation is accepted, revoked, or expired", () => {
      const registeredAt = new Date();
      const expiresAt = new Date(registeredAt.getTime() + 60_000);
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt,
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );

      expect(invitation.isPending(registeredAt)).toBe(true);
      expect(invitation.isPending(expiresAt)).toBe(false);

      invitation.accept(faker.database.mongodbObjectId(), registeredAt);
      expect(invitation.isPending(registeredAt)).toBe(false);
    });
  });

  describe("updateRole", () => {
    it("changes the invitation role while it is pending", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );
      const updatedAt = new Date();

      invitation.updateRole(MembershipRole.ADMIN, updatedAt);

      expect(invitation.role).toBe(MembershipRole.ADMIN);
      expect(invitation.updatedAt).toBe(updatedAt);
    });

    it("throws when the invitation is accepted", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );

      invitation.accept(faker.database.mongodbObjectId(), registeredAt);

      expect(() =>
        invitation.updateRole(MembershipRole.ADMIN, new Date()),
      ).toThrow(IdentityError.InvitationAlreadyAccepted.code);
    });

    it("throws when the role is invalid", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );

      expect(() =>
        invitation.updateRole("owner" as MembershipRole, new Date()),
      ).toThrow(IdentityError.InvalidMembershipRole.code);
    });
  });

  describe("updatePermissions", () => {
    it("changes the invitation permissions while it is pending", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );
      const updatedPermissions = [
        MembershipPermission.READ,
        MembershipPermission.WRITE,
      ];
      const updatedAt = new Date();

      invitation.updatePermissions(updatedPermissions, updatedAt);

      expect(invitation.permissions).toEqual(updatedPermissions);
      expect(invitation.permissions).not.toBe(updatedPermissions);
      expect(invitation.updatedAt).toBe(updatedAt);
    });

    it("throws when the invitation is revoked", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );

      invitation.revoke(registeredAt);

      expect(() =>
        invitation.updatePermissions([MembershipPermission.WRITE], new Date()),
      ).toThrow(IdentityError.InvitationRevoked.code);
    });

    it("throws when the invitation is expired", () => {
      const registeredAt = new Date();
      const expiresAt = new Date(registeredAt.getTime() + 60_000);
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt,
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );

      expect(() =>
        invitation.updatePermissions(
          [MembershipPermission.WRITE],
          new Date(expiresAt.getTime() + 1),
        ),
      ).toThrow(IdentityError.InvitationExpired.code);
    });

    it("throws when a permission is invalid", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );

      expect(() =>
        invitation.updatePermissions(
          ["manage" as MembershipPermission],
          new Date(),
        ),
      ).toThrow(IdentityError.InvalidMembershipPermissions.code);
    });
  });

  describe("accept", () => {
    it("accepts the invitation for the given account", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );
      const acceptedByAccountId = faker.database.mongodbObjectId();
      const acceptedAt = new Date();

      invitation.accept(acceptedByAccountId, acceptedAt);

      expect(invitation.isAccepted()).toBe(true);
      expect(invitation.acceptedAt).toBe(acceptedAt);
      expect(invitation.acceptedByAccountId?.value).toBe(acceptedByAccountId);
      expect(invitation.updatedAt).toBe(acceptedAt);
    });

    it("does not change acceptedAt when the invitation is already accepted", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );
      const firstAcceptedAt = new Date();
      const laterAcceptedAt = new Date();
      const acceptedByAccountId = faker.database.mongodbObjectId();

      invitation.accept(acceptedByAccountId, firstAcceptedAt);
      invitation.accept(faker.database.mongodbObjectId(), laterAcceptedAt);

      expect(invitation.acceptedAt).toBe(firstAcceptedAt);
      expect(invitation.acceptedByAccountId?.value).toBe(acceptedByAccountId);
    });
  });

  describe("revoke", () => {
    it("revokes a pending invitation", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );
      const revokedAt = new Date();

      invitation.revoke(revokedAt);

      expect(invitation.isRevoked()).toBe(true);
      expect(invitation.revokedAt).toBe(revokedAt);
      expect(invitation.updatedAt).toBe(revokedAt);
      expect(invitation.isPending(registeredAt)).toBe(false);
    });

    it("does not overwrite revokedAt when the invitation is already revoked", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );
      const firstRevokedAt = new Date();
      const laterRevokedAt = new Date();

      invitation.revoke(firstRevokedAt);
      invitation.revoke(laterRevokedAt);

      expect(invitation.revokedAt).toBe(firstRevokedAt);
    });

    it("throws when the invitation is already accepted", () => {
      const registeredAt = new Date();
      const invitation = Invitation.register(
        {
          id: faker.database.mongodbObjectId(),
          email: faker.internet.email().toLowerCase(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          tokenHash: faker.string.alphanumeric(32),
          expiresAt: new Date(registeredAt.getTime() + 60_000),
          createdBy: faker.database.mongodbObjectId(),
        },
        registeredAt,
      );

      invitation.accept(faker.database.mongodbObjectId(), registeredAt);

      expect(() => invitation.revoke(new Date())).toThrow(AppError);
      expect(() => invitation.revoke(new Date())).toThrow(
        IdentityError.InvitationAlreadyAccepted.code,
      );
    });
  });
});
