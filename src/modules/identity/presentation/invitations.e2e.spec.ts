import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { describe, expect, it, vi } from "vitest";

import { IdentityHttp, createIdentityHttp } from "./testing/identity-http";

import { seedAccount } from "@/identity/application/testing/identity-context";
import { INVITATION_TTL_MS } from "@/identity/application/token.policy";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

const failure = (out: { status: number; body?: unknown }) => ({
  status: out.status,
  code: (out.body as { code: string }).code,
});

const signInInviter = (http: IdentityHttp) =>
  http.signIn({
    permissions: [
      MembershipPermission.INVITATION_CREATE,
      MembershipPermission.INVITATION_READ,
      MembershipPermission.INVITATION_REVOKE,
    ],
  });

const buildInvite = () => ({
  email: faker.internet.email().toLowerCase(),
  role: MembershipRole.USER,
  permissions: [MembershipPermission.INVITATION_READ],
});

const invite = async (http: IdentityHttp, token: string) => {
  const body = buildInvite();
  const out = await http.call("POST", "/invitations", { token, body });
  const [sent] = http.ctx.mailer.invitations.slice(-1);
  return {
    body,
    out,
    invitationId: (out.body as { invitation: { id: string } }).invitation.id,
    invitationToken: sent?.token ?? "",
  };
};

const accept = (http: IdentityHttp, token: string) =>
  http.call("POST", "/auth/invitations/accept", {
    body: {
      token,
      name: faker.person.fullName(),
      password: faker.internet.password({ length: 16 }),
    },
  });

describe("invitations", () => {
  it.each([
    [
      "POST",
      "/invitations",
      { body: buildInvite() },
      MembershipPermission.INVITATION_CREATE,
    ],
    ["GET", "/invitations", {}, MembershipPermission.INVITATION_READ],
    [
      "DELETE",
      "/invitations/:invitationId",
      { params: { invitationId: faker.database.mongodbObjectId() } },
      MembershipPermission.INVITATION_REVOKE,
    ],
  ] as const)(
    "answers 403 permission_missing without the route's permission, even with the admin role (%s %s)",
    async (method, path, options, missing) => {
      const http = createIdentityHttp();
      const ana = await http.signIn({
        role: MembershipRole.ADMIN,
        permissions: Object.values(MembershipPermission).filter(
          (permission) => permission !== missing,
        ),
      });

      const out = await http.call(method, path, {
        ...options,
        token: ana.token,
      });

      expect(out).toMatchObject({
        status: 403,
        body: {
          code: SharedError.PermissionMissing.code,
          data: { required: missing },
        },
      });
    },
  );

  describe("POST /invitations", () => {
    it("invites an e-mail with 201 and sends the link", async () => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);

      const { out, body } = await invite(http, inviter.token);

      expect(out.status).toBe(201);
      expect(out.body).toMatchObject({
        invitation: {
          email: body.email,
          role: body.role,
          permissions: body.permissions,
          createdBy: inviter.accountId,
          acceptedAt: null,
          revokedAt: null,
        },
      });
      expect(out.body).not.toHaveProperty("invitation.tokenHash");
      expect(http.ctx.mailer.invitations).toMatchObject([
        { to: body.email, inviterName: inviter.account.name },
      ]);
    });

    it("lets a user holding invitation.create invite with what they have", async () => {
      const http = createIdentityHttp();
      const inviter = await http.signIn({
        permissions: [
          MembershipPermission.INVITATION_CREATE,
          MembershipPermission.INVITATION_READ,
        ],
      });

      const { out } = await invite(http, inviter.token);

      expect(out.status).toBe(201);
    });

    it("answers 400 for an e-mail that already has an account", async () => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);
      const ana = await seedAccount(http.ctx);

      const out = await http.call("POST", "/invitations", {
        token: inviter.token,
        body: { ...buildInvite(), email: ana.email },
      });

      expect(failure(out)).toStrictEqual({
        status: 400,
        code: IdentityError.AccountEmailTaken.code,
      });
    });

    it("lets an inviter give the admin role with permissions they hold", async () => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);
      const body = { ...buildInvite(), role: MembershipRole.ADMIN };

      const out = await http.call("POST", "/invitations", {
        token: inviter.token,
        body,
      });

      expect(out.status).toBe(201);
      expect(out.body).toMatchObject({
        invitation: {
          role: MembershipRole.ADMIN,
          permissions: body.permissions,
        },
      });
    });

    it("answers 403 forbidden when the inviter lacks one asked permission, whatever else they hold", async () => {
      const http = createIdentityHttp();
      const inviter = await http.signIn({
        role: MembershipRole.ADMIN,
        permissions: Object.values(MembershipPermission).filter(
          (permission) =>
            permission !== MembershipPermission.MEMBER_PERMISSIONS_UPDATE,
        ),
      });

      const out = await http.call("POST", "/invitations", {
        token: inviter.token,
        body: {
          ...buildInvite(),
          permissions: Object.values(MembershipPermission),
        },
      });

      expect(failure(out)).toStrictEqual({
        status: 403,
        code: IdentityError.Forbidden.code,
      });
    });

    it("answers 403 forbidden when the inviter grants a permission they do not have", async () => {
      const http = createIdentityHttp();
      const inviter = await http.signIn({
        permissions: [MembershipPermission.INVITATION_CREATE],
      });

      const out = await http.call("POST", "/invitations", {
        token: inviter.token,
        body: {
          ...buildInvite(),
          permissions: [MembershipPermission.ACCOUNT_DEACTIVATE],
        },
      });

      expect(failure(out)).toStrictEqual({
        status: 403,
        code: IdentityError.Forbidden.code,
      });
    });

    it("answers 422 when the invitation e-mail cannot be delivered", async () => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);
      vi.spyOn(http.ctx.mailer, "sendInvitation").mockRejectedValue(
        new AppError(IdentityError.EmailDeliveryFailed),
      );

      const out = await http.call("POST", "/invitations", {
        token: inviter.token,
        body: buildInvite(),
      });

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.EmailDeliveryFailed.code,
      });
    });
  });

  describe("GET /invitations", () => {
    it("lists the pending invitations to a user-role member holding invitation.read, newest first, with 200", async () => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);
      const first = await invite(http, inviter.token);
      http.ctx.clock.advance(1_000);
      const second = await invite(http, inviter.token);
      const accepted = await invite(http, inviter.token);
      await accept(http, accepted.invitationToken);

      const out = await http.call("GET", "/invitations", {
        token: inviter.token,
      });

      expect(out.status).toBe(200);
      expect(
        (out.body as { invitations: { id: string }[] }).invitations.map(
          (invitation) => invitation.id,
        ),
      ).toStrictEqual([second.invitationId, first.invitationId]);
    });
  });

  describe("DELETE /invitations/:invitationId", () => {
    it("revokes an invitation with 204, so its link stops working", async () => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);
      const { invitationId, invitationToken } = await invite(
        http,
        inviter.token,
      );

      const out = await http.call("DELETE", "/invitations/:invitationId", {
        token: inviter.token,
        params: { invitationId },
      });
      const accepted = await accept(http, invitationToken);

      expect(out.status).toBe(204);
      expect(failure(accepted)).toStrictEqual({
        status: 422,
        code: IdentityError.InvitationRevoked.code,
      });
    });

    it.each([
      ["400 for an id that is not an id", faker.string.alpha(5), 400],
      ["404 for an unknown invitation", faker.database.mongodbObjectId(), 404],
    ])("answers %s", async (_, invitationId, status) => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);

      const out = await http.call("DELETE", "/invitations/:invitationId", {
        token: inviter.token,
        params: { invitationId },
      });

      expect(out.status).toBe(status);
    });

    it("answers 422 for an invitation already accepted", async () => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);
      const { invitationId, invitationToken } = await invite(
        http,
        inviter.token,
      );
      await accept(http, invitationToken);

      const out = await http.call("DELETE", "/invitations/:invitationId", {
        token: inviter.token,
        params: { invitationId },
      });

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.InvitationAlreadyAccepted.code,
      });
    });
  });

  describe("POST /auth/invitations/accept", () => {
    it("creates the account with 201, with the invited role and a verified e-mail", async () => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);
      const { body, invitationToken } = await invite(http, inviter.token);

      const out = await accept(http, invitationToken);
      const me = await http.call("GET", "/me", {
        token: (out.body as { accessToken: string }).accessToken,
      });

      expect(out.status).toBe(201);
      expect(me.body).toMatchObject({
        account: {
          email: body.email,
          emailVerifiedAt: expect.any(String) as unknown,
        },
        membership: { role: body.role, permissions: body.permissions },
      });
    });

    it("answers 400 for a password shorter than the policy", async () => {
      const http = createIdentityHttp();

      const out = await http.call("POST", "/auth/invitations/accept", {
        body: {
          token: faker.string.alphanumeric(43),
          name: faker.person.fullName(),
          password: faker.string.alphanumeric(11),
        },
      });

      expect(out.status).toBe(400);
    });

    it("answers 401 for an unknown token", async () => {
      const http = createIdentityHttp();

      const out = await accept(http, faker.string.alphanumeric(43));

      expect(failure(out)).toStrictEqual({
        status: 401,
        code: IdentityError.InvalidInvitationToken.code,
      });
    });

    it.each([
      [
        "accepted",
        IdentityError.InvitationAlreadyAccepted.code,
        async (http: IdentityHttp, token: string) => {
          await accept(http, token);
        },
      ],
      [
        "expired",
        IdentityError.InvitationExpired.code,
        (http: IdentityHttp) => {
          http.ctx.clock.advance(INVITATION_TTL_MS);
          return Promise.resolve();
        },
      ],
    ])("answers 422 for an invitation already %s", async (_, code, given) => {
      const http = createIdentityHttp();
      const inviter = await signInInviter(http);
      const { invitationToken } = await invite(http, inviter.token);
      await given(http, invitationToken);

      const out = await accept(http, invitationToken);

      expect(failure(out)).toStrictEqual({ status: 422, code });
    });

    it("answers 429 past the limit for one IP", async () => {
      const http = createIdentityHttp();
      const ip = faker.internet.ip();
      for (let i = 0; i < 10; i++) {
        await http.call("POST", "/auth/invitations/accept", { ip, body: {} });
      }

      const out = await http.call("POST", "/auth/invitations/accept", {
        ip,
        body: {},
      });

      expect(failure(out)).toStrictEqual({
        status: 429,
        code: SharedError.RateLimited.code,
      });
    });
  });
});
