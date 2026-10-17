import { AppError } from "@shared/domain/errors/app-error";
import { fakeUuid } from "@shared/testing/uuid";
import { describe, expect, it } from "vitest";

import { IdentityError } from "./errors/identity.error";
import {
  Membership,
  MembershipPermission,
  MembershipRole,
} from "./membership.entity";

describe("Membership", () => {
  describe("register", () => {
    it("creates a membership with the given identity and default state", () => {
      const id = fakeUuid();
      const accountId = fakeUuid();
      const createdBy = fakeUuid();
      const registeredAt = new Date();

      const membership = Membership.register(
        {
          id,
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy,
          accountId,
        },
        registeredAt,
      );

      expect(membership.id.value).toBe(id);
      expect(membership.role).toBe(MembershipRole.USER);
      expect(membership.permissions).toEqual([MembershipPermission.READ]);
      expect(membership.createdBy.value).toBe(createdBy);
      expect(membership.accountId.value).toBe(accountId);
      expect(membership.version).toBe(0);
      expect(membership.createdAt).toBe(registeredAt);
      expect(membership.updatedAt).toBe(registeredAt);
      expect(membership.deletedAt).toBeNull();
      expect(membership.isDeleted()).toBe(false);
    });

    it("throws when the role is invalid", () => {
      expect(() =>
        Membership.register(
          {
            id: fakeUuid(),
            role: "owner" as MembershipRole,
            permissions: [MembershipPermission.READ],
            createdBy: fakeUuid(),
            accountId: fakeUuid(),
          },
          new Date(),
        ),
      ).toThrow(IdentityError.InvalidMembershipRole.code);
    });

    it("throws when a permission is invalid", () => {
      expect(() =>
        Membership.register(
          {
            id: fakeUuid(),
            role: MembershipRole.USER,
            permissions: ["manage" as MembershipPermission],
            createdBy: fakeUuid(),
            accountId: fakeUuid(),
          },
          new Date(),
        ),
      ).toThrow(IdentityError.InvalidMembershipPermissions.code);
    });
  });

  describe("restore", () => {
    it("rebuilds a membership from persisted state", () => {
      const persistedState = {
        id: fakeUuid(),
        role: MembershipRole.ADMIN,
        permissions: [MembershipPermission.ADMIN],
        createdBy: fakeUuid(),
        accountId: fakeUuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 3,
        deletedAt: null,
      };

      const membership = Membership.restore(persistedState);

      expect(membership.toSnapshot()).toEqual(persistedState);
    });
  });

  describe("toSnapshot", () => {
    it("returns a snapshot of the current membership state", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ, MembershipPermission.WRITE],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );

      const snapshot = membership.toSnapshot();

      expect(snapshot.id).toBe(membership.id.value);
      expect(snapshot.role).toBe(membership.role);
      expect(snapshot.permissions).toEqual(membership.permissions);
      expect(snapshot.permissions).not.toBe(membership.permissions);
      expect(snapshot.createdBy).toBe(membership.createdBy.value);
      expect(snapshot.accountId).toBe(membership.accountId.value);
      expect(snapshot.version).toBe(membership.version);
      expect(snapshot.createdAt).toBe(membership.createdAt);
      expect(snapshot.updatedAt).toBe(membership.updatedAt);
      expect(snapshot.deletedAt).toBe(membership.deletedAt);
    });
  });

  describe("updateRole", () => {
    it("changes the membership role", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );
      const updatedAt = new Date();

      membership.updateRole(MembershipRole.ADMIN, updatedAt);

      expect(membership.role).toBe(MembershipRole.ADMIN);
      expect(membership.updatedAt).toBe(updatedAt);
    });

    it("throws when the membership is deleted", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );

      membership.markAsDeleted(new Date());

      expect(() =>
        membership.updateRole(MembershipRole.ADMIN, new Date()),
      ).toThrow(AppError);
      expect(() =>
        membership.updateRole(MembershipRole.ADMIN, new Date()),
      ).toThrow(IdentityError.MembershipDeleted.code);
    });

    it("throws when the role is invalid", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );

      expect(() =>
        membership.updateRole("owner" as MembershipRole, new Date()),
      ).toThrow(IdentityError.InvalidMembershipRole.code);
    });
  });

  describe("updatePermissions", () => {
    it("changes the membership permissions", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );
      const updatedPermissions = [
        MembershipPermission.READ,
        MembershipPermission.WRITE,
        MembershipPermission.DELETE,
      ];
      const updatedAt = new Date();

      membership.updatePermissions(updatedPermissions, updatedAt);

      expect(membership.permissions).toEqual(updatedPermissions);
      expect(membership.permissions).not.toBe(updatedPermissions);
      expect(membership.updatedAt).toBe(updatedAt);
    });

    it("throws when the membership is deleted", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );

      membership.markAsDeleted(new Date());

      expect(() =>
        membership.updatePermissions([MembershipPermission.WRITE], new Date()),
      ).toThrow(IdentityError.MembershipDeleted.code);
    });

    it("throws when a permission is invalid", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );

      expect(() =>
        membership.updatePermissions(
          [MembershipPermission.READ, "manage" as MembershipPermission],
          new Date(),
        ),
      ).toThrow(IdentityError.InvalidMembershipPermissions.code);
    });
  });

  describe("markAsDeleted", () => {
    it("marks the membership as deleted", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );
      const deletedAt = new Date();

      membership.markAsDeleted(deletedAt);

      expect(membership.deletedAt).toBe(deletedAt);
      expect(membership.isDeleted()).toBe(true);
    });

    it("does not overwrite deletedAt when the membership is already deleted", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );
      const firstDeletedAt = new Date();
      const laterDeletedAt = new Date();

      membership.markAsDeleted(firstDeletedAt);
      membership.markAsDeleted(laterDeletedAt);

      expect(membership.deletedAt).toBe(firstDeletedAt);
    });
  });

  describe("reactivate", () => {
    it("keeps the membership active when it was never deleted", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );

      membership.reactivate(new Date());

      expect(membership.deletedAt).toBeNull();
      expect(membership.isDeleted()).toBe(false);
    });

    it("clears deletedAt when the membership is deleted", () => {
      const membership = Membership.register(
        {
          id: fakeUuid(),
          role: MembershipRole.USER,
          permissions: [MembershipPermission.READ],
          createdBy: fakeUuid(),
          accountId: fakeUuid(),
        },
        new Date(),
      );
      const deletedAt = new Date();
      const reactivatedAt = new Date();

      membership.markAsDeleted(deletedAt);
      membership.reactivate(reactivatedAt);

      expect(membership.isDeleted()).toBe(false);
      expect(membership.deletedAt).toBeNull();
      expect(membership.updatedAt).toBe(reactivatedAt);
    });
  });
});
