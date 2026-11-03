import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { Actor } from "../actor";
import { createIdentityContext } from "../testing/identity-context";

import { AccessPolicy } from "./access.policy";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import { MembershipRole } from "@/identity/domain/membership.entity";

const makeActor = (overrides: Partial<Actor> = {}): Actor => ({
  accountId: faker.database.mongodbObjectId(),
  sessionId: faker.database.mongodbObjectId(),
  membershipId: faker.database.mongodbObjectId(),
  role: MembershipRole.USER,
  permissions: [],
  ...overrides,
});

const required = IdentityPermission.ACCOUNT_DEACTIVATE;

const outsideCatalog = () =>
  `${faker.string.alpha({ length: 10, casing: "lower" })}.${faker.string.alpha({ length: 10, casing: "lower" })}`;

const unknownPermissions = (permissions: string[]): Error =>
  expect.objectContaining({
    code: IdentityError.InvalidMembershipPermissions.code,
    data: { permissions },
  }) as Error;

describe("AccessPolicy", () => {
  const { permissions, otherModulePermissions } = createIdentityContext();
  const policy = new AccessPolicy({ permissions });
  const [otherPermission] = otherModulePermissions.permissions;

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
        permissions: Object.values(IdentityPermission).filter(
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
          IdentityPermission.INVITATION_CREATE,
          IdentityPermission.INVITATION_READ,
        ],
      });

      expect(() =>
        policy.ensureCanGrant(inviter, [IdentityPermission.INVITATION_READ]),
      ).not.toThrow();
    });

    it("refuses a grant beyond the actor's own permissions, whatever they hold", () => {
      const missing = IdentityPermission.MEMBER_PERMISSIONS_UPDATE;
      const inviter = makeActor({
        role: MembershipRole.ADMIN,
        permissions: Object.values(IdentityPermission).filter(
          (permission) => permission !== missing,
        ),
      });

      expect(() => policy.ensureCanGrant(inviter, [missing])).toThrow(
        IdentityError.Forbidden.code,
      );
    });

    it("allows granting a permission another module declares that the actor holds", () => {
      const inviter = makeActor({ permissions: [otherPermission] });

      expect(() =>
        policy.ensureCanGrant(inviter, [otherPermission]),
      ).not.toThrow();
    });

    it("refuses a code outside the catalog before what the actor holds", () => {
      const unknown = outsideCatalog();
      const inviter = makeActor();

      expect(() =>
        policy.ensureCanGrant(inviter, [
          IdentityPermission.INVITATION_READ,
          unknown,
        ]),
      ).toThrow(unknownPermissions([unknown]));
    });
  });

  describe("ensureCanChangePermissions", () => {
    const held = IdentityPermission.INVITATION_READ;
    const notHeld = IdentityPermission.SESSION_REVOKE;

    it("allows changing held permissions while keeping the ones the actor lacks", () => {
      const admin = makeActor({ permissions: [held] });

      expect(() =>
        policy.ensureCanChangePermissions(admin, [notHeld], [notHeld, held]),
      ).not.toThrow();
    });

    it.each([
      ["adding", [], [notHeld]],
      ["removing", [notHeld], []],
    ])("refuses %s a permission the actor does not hold", (_, from, to) => {
      const admin = makeActor({ permissions: [held] });

      expect(() => policy.ensureCanChangePermissions(admin, from, to)).toThrow(
        IdentityError.Forbidden.code,
      );
    });

    it("refuses a code outside the catalog before what the actor holds", () => {
      const unknown = outsideCatalog();
      const admin = makeActor({ permissions: [held] });

      expect(() =>
        policy.ensureCanChangePermissions(admin, [], [notHeld, unknown]),
      ).toThrow(unknownPermissions([unknown]));
    });

    it("lets a code outside the catalog stay", () => {
      const unknown = outsideCatalog();
      const admin = makeActor({ permissions: [held] });

      expect(() =>
        policy.ensureCanChangePermissions(admin, [unknown], [unknown, held]),
      ).not.toThrow();
    });

    it("lets the actor remove a code outside the catalog they do not hold", () => {
      const unknown = outsideCatalog();
      const admin = makeActor({ permissions: [held] });

      expect(() =>
        policy.ensureCanChangePermissions(admin, [unknown, held], [held]),
      ).not.toThrow();
    });
  });
});
