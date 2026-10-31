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

const required = MembershipPermission.ACCOUNT_DEACTIVATE;

describe("AccessPolicy", () => {
  const policy = new AccessPolicy();

  describe("ensureCanManageAccount", () => {
    it("lets the owner manage their own account", () => {
      const owner = makeActor();

      expect(() =>
        policy.ensureCanManageAccount(owner, owner.accountId, required),
      ).not.toThrow();
    });

    it("lets a holder of the required permission manage another account", () => {
      const actor = makeActor({ permissions: [required] });

      expect(() =>
        policy.ensureCanManageAccount(
          actor,
          faker.database.mongodbObjectId(),
          required,
        ),
      ).not.toThrow();
    });

    it("throws Forbidden for anyone else on another account, even with the admin role", () => {
      const actor = makeActor({
        role: MembershipRole.ADMIN,
        permissions: Object.values(MembershipPermission).filter(
          (permission) => permission !== required,
        ),
      });

      expect(() =>
        policy.ensureCanManageAccount(
          actor,
          faker.database.mongodbObjectId(),
          required,
        ),
      ).toThrow(IdentityError.Forbidden.code);
    });
  });

  describe("ensureCanGrant", () => {
    it("allows a grant within the actor's own permissions", () => {
      const inviter = makeActor({
        permissions: [
          MembershipPermission.INVITATION_CREATE,
          MembershipPermission.INVITATION_READ,
        ],
      });

      expect(() =>
        policy.ensureCanGrant(inviter, [MembershipPermission.INVITATION_READ]),
      ).not.toThrow();
    });

    it("refuses a grant beyond the actor's own permissions, whatever they hold", () => {
      const missing = MembershipPermission.MEMBER_PERMISSIONS_UPDATE;
      const inviter = makeActor({
        role: MembershipRole.ADMIN,
        permissions: Object.values(MembershipPermission).filter(
          (permission) => permission !== missing,
        ),
      });

      expect(() => policy.ensureCanGrant(inviter, [missing])).toThrow(
        IdentityError.Forbidden.code,
      );
    });
  });
});
