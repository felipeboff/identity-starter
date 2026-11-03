import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { PERMISSION_MAX_LENGTH } from "@shared/domain/value-objects/permission-catalog.value-object";
import { describe, expect, it } from "vitest";

import { createIdentityHttp } from "./testing/identity-http";

import { seedAccount } from "@/identity/application/testing/identity-context";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import { MembershipRole } from "@/identity/domain/membership.entity";

const segment = () => faker.string.alpha({ length: 10, casing: "lower" });

const outsideCatalog = () => `${segment()}.${segment()}`;

describe("permissions", () => {
  describe("GET /permissions", () => {
    it("lists every permission in the catalog in alphabetical order", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();

      const out = await http.call("GET", "/permissions", { token: ana.token });

      expect(out).toMatchObject({
        status: 200,
        body: {
          permissions: [
            ...Object.values(IdentityPermission),
            ...http.ctx.otherModulePermissions.permissions,
          ].sort(),
        },
      });
    });

    it("answers 401 without a valid access token", async () => {
      const http = createIdentityHttp();

      const out = await http.call("GET", "/permissions");

      expect(out.status).toBe(401);
    });
  });

  describe("PUT /members/:accountId/permissions", () => {
    it("adds a permission another module declares", async () => {
      const http = createIdentityHttp();
      const [permission] = http.ctx.otherModulePermissions.permissions;
      const admin = await http.signIn({
        permissions: [IdentityPermission.MEMBER_PERMISSIONS_UPDATE, permission],
      });
      const bob = await seedAccount(http.ctx);

      const out = await http.call("PUT", "/members/:accountId/permissions", {
        token: admin.token,
        params: { accountId: bob.accountId },
        body: { permissions: [permission] },
      });

      expect(out).toMatchObject({
        status: 200,
        body: { membership: { permissions: [permission] } },
      });
    });

    it("answers 400 for an added permission outside the catalog, even one the actor lacks", async () => {
      const http = createIdentityHttp();
      const admin = await http.signIn({
        permissions: [IdentityPermission.MEMBER_PERMISSIONS_UPDATE],
      });
      const bob = await seedAccount(http.ctx);
      const unknown = outsideCatalog();

      const out = await http.call("PUT", "/members/:accountId/permissions", {
        token: admin.token,
        params: { accountId: bob.accountId },
        body: { permissions: [IdentityPermission.SESSION_REVOKE_ALL, unknown] },
      });

      expect(out).toMatchObject({
        status: 400,
        body: {
          code: IdentityError.InvalidMembershipPermissions.code,
          data: { permissions: [unknown] },
        },
      });
      const membership = await http.ctx.memberships.findByAccountId(
        bob.accountId,
      );
      expect(membership?.permissions).toStrictEqual([]);
    });

    it("keeps a code that left the catalog", async () => {
      const http = createIdentityHttp();
      const admin = await http.signIn({
        permissions: [
          IdentityPermission.MEMBER_PERMISSIONS_UPDATE,
          IdentityPermission.MEMBER_READ,
        ],
      });
      const unknown = outsideCatalog();
      const bob = await seedAccount(http.ctx, { permissions: [unknown] });

      const out = await http.call("PUT", "/members/:accountId/permissions", {
        token: admin.token,
        params: { accountId: bob.accountId },
        body: { permissions: [unknown, IdentityPermission.MEMBER_READ] },
      });

      expect(out).toMatchObject({
        status: 200,
        body: {
          membership: {
            permissions: [unknown, IdentityPermission.MEMBER_READ],
          },
        },
      });
    });

    it("removes a code that left the catalog, which the actor does not hold", async () => {
      const http = createIdentityHttp();
      const admin = await http.signIn({
        permissions: [IdentityPermission.MEMBER_PERMISSIONS_UPDATE],
      });
      const unknown = outsideCatalog();
      const bob = await seedAccount(http.ctx, { permissions: [unknown] });

      const out = await http.call("PUT", "/members/:accountId/permissions", {
        token: admin.token,
        params: { accountId: bob.accountId },
        body: { permissions: [] },
      });

      expect(out).toMatchObject({
        status: 200,
        body: { membership: { permissions: [] } },
      });
    });
  });

  describe("GET /members", () => {
    it("lists a member's code that left the catalog", async () => {
      const http = createIdentityHttp();
      const admin = await http.signIn({
        permissions: [IdentityPermission.MEMBER_READ],
      });
      const unknown = outsideCatalog();
      const bob = await seedAccount(http.ctx, { permissions: [unknown] });

      const out = await http.call("GET", "/members", { token: admin.token });

      expect(out.status).toBe(200);
      const { members } = out.body as {
        members: {
          account: { id: string };
          membership: { permissions: string[] };
        }[];
      };
      expect(
        members.find((member) => member.account.id === bob.accountId)
          ?.membership.permissions,
      ).toStrictEqual([unknown]);
    });
  });

  it.each([
    ["an uppercase letter", () => `${segment()}.${segment()}A`],
    ["a single segment", () => segment()],
    ["an empty segment", () => `${segment()}..${segment()}`],
    [
      "more than the maximum length",
      () =>
        `${segment()}.${faker.string.alpha({ length: PERMISSION_MAX_LENGTH, casing: "lower" })}`,
    ],
  ])(
    "answers 400 input_invalid for a permission outside the pattern: %s",
    async (_, build) => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      const bob = await seedAccount(http.ctx);
      const permissions = [build()];

      const invite = await http.call("POST", "/invitations", {
        token: ana.token,
        body: {
          email: faker.internet.email(),
          role: MembershipRole.USER,
          permissions,
        },
      });
      const change = await http.call("PUT", "/members/:accountId/permissions", {
        token: ana.token,
        params: { accountId: bob.accountId },
        body: { permissions },
      });

      for (const out of [invite, change]) {
        expect(out).toMatchObject({
          status: 400,
          body: { code: SharedError.InputInvalid.code },
        });
      }
    },
  );
});
