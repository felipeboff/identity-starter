import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityError } from "./errors/identity.error";
import {
  Membership,
  MembershipPermission,
  MembershipRegister,
  MembershipRole,
} from "./membership.entity";

const CREATED_AT = faker.date.past();
const LATER = faker.date.soon({ refDate: CREATED_AT });
const EVEN_LATER = faker.date.soon({ refDate: LATER });

const makeMembership = (overrides: Partial<MembershipRegister> = {}) =>
  Membership.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId: faker.database.mongodbObjectId(),
      createdBy: faker.database.mongodbObjectId(),
      role: MembershipRole.USER,
      permissions: [MembershipPermission.INVITATION_READ],
      ...overrides,
    },
    CREATED_AT,
  );

const makeDeletedMembership = () => {
  const membership = makeMembership();
  membership.markAsDeleted(CREATED_AT);
  return membership;
};

describe("Membership", () => {
  describe("register", () => {
    it("creates an active membership at version 0", () => {
      const id = faker.database.mongodbObjectId();
      const accountId = faker.database.mongodbObjectId();
      const createdBy = faker.database.mongodbObjectId();

      const membership = makeMembership({ id, accountId, createdBy });

      expect(membership.toSnapshot()).toEqual({
        id,
        accountId,
        createdBy,
        role: MembershipRole.USER,
        permissions: [MembershipPermission.INVITATION_READ],
        version: 0,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        deletedAt: null,
      });
      expect(membership.isDeleted()).toBe(false);
    });

    it("throws InvalidMembershipRole when the role is unknown", () => {
      expect(() =>
        makeMembership({ role: faker.string.alpha(12) as MembershipRole }),
      ).toThrow(IdentityError.InvalidMembershipRole.code);
    });

    it("throws InvalidMembershipPermissions when a permission is unknown", () => {
      expect(() =>
        makeMembership({
          permissions: [faker.string.alpha(12) as MembershipPermission],
        }),
      ).toThrow(IdentityError.InvalidMembershipPermissions.code);
    });
  });

  describe("restore", () => {
    it("rebuilds the membership from persisted state", () => {
      const persisted = {
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        createdBy: faker.database.mongodbObjectId(),
        role: MembershipRole.ADMIN,
        permissions: [MembershipPermission.MEMBER_PERMISSIONS_UPDATE],
        version: faker.number.int({ min: 1, max: 10 }),
        createdAt: CREATED_AT,
        updatedAt: LATER,
        deletedAt: null,
      };

      const membership = Membership.restore(persisted);

      expect(membership.toSnapshot()).toEqual(persisted);
    });
  });

  describe("getters", () => {
    it("expose the membership state", () => {
      const membership = makeMembership();
      const snapshot = membership.toSnapshot();

      expect({
        id: membership.id.value,
        accountId: membership.accountId.value,
        createdBy: membership.createdBy.value,
        role: membership.role,
        permissions: membership.permissions,
        version: membership.version,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
        deletedAt: membership.deletedAt,
      }).toEqual(snapshot);
    });

    it("return copies of the permissions so callers cannot mutate them", () => {
      const membership = makeMembership();

      membership.permissions.push(
        MembershipPermission.MEMBER_PERMISSIONS_UPDATE,
      );
      membership
        .toSnapshot()
        .permissions.push(MembershipPermission.MEMBER_PERMISSIONS_UPDATE);

      expect(membership.permissions).toEqual([
        MembershipPermission.INVITATION_READ,
      ]);
    });
  });

  describe("updateRole", () => {
    it("changes the role and touches updatedAt", () => {
      const membership = makeMembership({ role: MembershipRole.USER });

      membership.updateRole(MembershipRole.ADMIN, LATER);

      expect(membership.role).toBe(MembershipRole.ADMIN);
      expect(membership.updatedAt).toBe(LATER);
    });

    it("throws MembershipDeleted when the membership is deleted", () => {
      const membership = makeDeletedMembership();

      expect(() => membership.updateRole(MembershipRole.ADMIN, LATER)).toThrow(
        IdentityError.MembershipDeleted.code,
      );
    });

    it("throws InvalidMembershipRole when the role is unknown", () => {
      const membership = makeMembership();

      expect(() =>
        membership.updateRole(faker.string.alpha(12) as MembershipRole, LATER),
      ).toThrow(IdentityError.InvalidMembershipRole.code);
    });
  });

  describe("updatePermissions", () => {
    it("replaces the permissions with a copy and touches updatedAt", () => {
      const membership = makeMembership();
      const permissions: MembershipPermission[] = [
        MembershipPermission.INVITATION_READ,
        MembershipPermission.INVITATION_REVOKE,
      ];

      membership.updatePermissions(permissions, LATER);
      permissions.push(MembershipPermission.MEMBER_PERMISSIONS_UPDATE);

      expect(membership.permissions).toEqual([
        MembershipPermission.INVITATION_READ,
        MembershipPermission.INVITATION_REVOKE,
      ]);
      expect(membership.updatedAt).toBe(LATER);
    });

    it("throws MembershipDeleted when the membership is deleted", () => {
      const membership = makeDeletedMembership();

      expect(() =>
        membership.updatePermissions(
          [MembershipPermission.INVITATION_REVOKE],
          LATER,
        ),
      ).toThrow(IdentityError.MembershipDeleted.code);
    });

    it("throws InvalidMembershipPermissions when a permission is unknown", () => {
      const membership = makeMembership();

      expect(() =>
        membership.updatePermissions(
          [faker.string.alpha(12) as MembershipPermission],
          LATER,
        ),
      ).toThrow(IdentityError.InvalidMembershipPermissions.code);
    });
  });

  describe("markAsDeleted", () => {
    it("sets deletedAt and touches updatedAt", () => {
      const membership = makeMembership();

      membership.markAsDeleted(LATER);

      expect(membership.isDeleted()).toBe(true);
      expect(membership.deletedAt).toBe(LATER);
      expect(membership.updatedAt).toBe(LATER);
    });

    it("keeps the first deletedAt when called twice", () => {
      const membership = makeMembership();

      membership.markAsDeleted(LATER);
      membership.markAsDeleted(EVEN_LATER);

      expect(membership.deletedAt).toBe(LATER);
    });
  });

  describe("reactivate", () => {
    it("clears deletedAt and touches updatedAt", () => {
      const membership = makeDeletedMembership();

      membership.reactivate(LATER);

      expect(membership.isDeleted()).toBe(false);
      expect(membership.deletedAt).toBeNull();
      expect(membership.updatedAt).toBe(LATER);
    });

    it("does nothing when the membership is active", () => {
      const membership = makeMembership();

      membership.reactivate(LATER);

      expect(membership.deletedAt).toBeNull();
      expect(membership.updatedAt).toBe(CREATED_AT);
    });
  });

  describe("markAsSaved", () => {
    it("moves the version one step ahead on every save", () => {
      const entity = makeMembership();

      entity.markAsSaved();
      const afterFirst = entity.version;
      entity.markAsSaved();

      expect([afterFirst, entity.version]).toStrictEqual([1, 2]);
    });
  });
});
