import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { Actor } from "../actor";

import { AccessPolicy } from "./access.policy";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

const makeActor = (overrides: Partial<Actor> = {}): Actor => ({
  accountId: faker.database.mongodbObjectId(),
  sessionId: faker.database.mongodbObjectId(),
  membershipId: faker.database.mongodbObjectId(),
  role: MembershipRole.USER,
  permissions: [],
  ...overrides,
});

describe("AccessPolicy", () => {
  const policy = new AccessPolicy();

  describe("ensureAdmin", () => {
    it("passes for an admin", () => {
      const admin = makeActor({ role: MembershipRole.ADMIN });

      expect(() => policy.ensureAdmin(admin)).not.toThrow();
    });

    it("throws Forbidden for a regular user", () => {
      const user = makeActor({ role: MembershipRole.USER });

      expect(() => policy.ensureAdmin(user)).toThrow(
        IdentityError.Forbidden.code,
      );
    });
  });

  describe("ensureCanManageAccount", () => {
    it("lets a regular user manage their own account", () => {
      const user = makeActor({ role: MembershipRole.USER });

      expect(() =>
        policy.ensureCanManageAccount(user, user.accountId),
      ).not.toThrow();
    });

    it("lets an admin manage another account", () => {
      const admin = makeActor({ role: MembershipRole.ADMIN });

      expect(() =>
        policy.ensureCanManageAccount(admin, faker.database.mongodbObjectId()),
      ).not.toThrow();
    });

    it("throws Forbidden when a regular user manages another account", () => {
      const user = makeActor({ role: MembershipRole.USER });

      expect(() =>
        policy.ensureCanManageAccount(user, faker.database.mongodbObjectId()),
      ).toThrow(IdentityError.Forbidden.code);
    });
  });

  describe("ensureCanInvite", () => {
    it.each([
      ["an admin", makeActor({ role: MembershipRole.ADMIN })],
      [
        "a user with the invite permission",
        makeActor({ permissions: [MembershipPermission.INVITE] }),
      ],
    ])("lets %s invite", (_, actor) => {
      expect(() => policy.ensureCanInvite(actor)).not.toThrow();
    });

    it("throws Forbidden for a user without the invite permission", () => {
      expect(() => policy.ensureCanInvite(makeActor())).toThrow(
        IdentityError.Forbidden.code,
      );
    });
  });

  describe("ensureCanGrant", () => {
    const inviter = makeActor({
      permissions: [MembershipPermission.INVITE, MembershipPermission.READ],
    });

    it("lets an admin grant any role and permission", () => {
      const admin = makeActor({ role: MembershipRole.ADMIN });

      expect(() =>
        policy.ensureCanGrant(
          admin,
          MembershipRole.ADMIN,
          Object.values(MembershipPermission),
        ),
      ).not.toThrow();
    });

    it("lets a user grant the user role with permissions they have", () => {
      expect(() =>
        policy.ensureCanGrant(inviter, MembershipRole.USER, [
          MembershipPermission.READ,
        ]),
      ).not.toThrow();
    });

    it.each([
      ["the admin role", MembershipRole.ADMIN, []],
      [
        "a permission they do not have",
        MembershipRole.USER,
        [MembershipPermission.DELETE],
      ],
    ])("throws Forbidden when a user grants %s", (_, role, permissions) => {
      expect(() => policy.ensureCanGrant(inviter, role, permissions)).toThrow(
        IdentityError.Forbidden.code,
      );
    });
  });
});
