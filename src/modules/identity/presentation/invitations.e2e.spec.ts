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

const signInAdmin = (http: IdentityHttp) =>
  http.signIn({ role: MembershipRole.ADMIN });

const buildInvite = () => ({
  email: faker.internet.email().toLowerCase(),
  role: MembershipRole.USER,
  permissions: [MembershipPermission.READ],
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
  describe("POST /invitations", () => {
    it("invites an e-mail with 201 and sends the link", async () => {
      const http = createIdentityHttp();
      const admin = await signInAdmin(http);

      const { out, body } = await invite(http, admin.token);

      expect(out.status).toBe(201);
      expect(out.body).toMatchObject({
        invitation: {
          email: body.email,
          role: body.role,
          permissions: body.permissions,
          createdBy: admin.accountId,
          acceptedAt: null,
          revokedAt: null,
        },
      });
      expect(out.body).not.toHaveProperty("invitation.tokenHash");
      expect(http.ctx.mailer.invitations).toMatchObject([
        { to: body.email, inviterName: admin.account.name },
      ]);
    });

    it("lets a user with the invite permission invite with what they have", async () => {
      const http = createIdentityHttp();
      const inviter = await http.signIn({
        permissions: [MembershipPermission.INVITE, MembershipPermission.READ],
      });

      const { out } = await invite(http, inviter.token);

      expect(out.status).toBe(201);
    });

    it("answers 400 for an e-mail that already has an account", async () => {
      const http = createIdentityHttp();
      const admin = await signInAdmin(http);
      const ana = await seedAccount(http.ctx);

      const out = await http.call("POST", "/invitations", {
        token: admin.token,
        body: { ...buildInvite(), email: ana.email },
      });

      expect(failure(out)).toStrictEqual({
        status: 400,
        code: IdentityError.AccountEmailTaken.code,
      });
    });

    it.each([
      ["has no invite permission", [], MembershipRole.USER],
      [
        "grants the admin role",
        [MembershipPermission.INVITE, MembershipPermission.READ],
        MembershipRole.ADMIN,
      ],
    ])("answers 403 when the inviter %s", async (_, permissions, role) => {
      const http = createIdentityHttp();
      const inviter = await http.signIn({ permissions });

      const out = await http.call("POST", "/invitations", {
        token: inviter.token,
        body: { ...buildInvite(), role },
      });

      expect(failure(out)).toStrictEqual({
        status: 403,
        code: IdentityError.Forbidden.code,
      });
    });

    it("answers 403 when the inviter grants a permission they do not have", async () => {
      const http = createIdentityHttp();
      const inviter = await http.signIn({
        permissions: [MembershipPermission.INVITE],
      });

      const out = await http.call("POST", "/invitations", {
        token: inviter.token,
        body: { ...buildInvite(), permissions: [MembershipPermission.DELETE] },
      });

      expect(out.status).toBe(403);
    });

    it("answers 422 when the invitation e-mail cannot be delivered", async () => {
      const http = createIdentityHttp();
      const admin = await signInAdmin(http);
      vi.spyOn(http.ctx.mailer, "sendInvitation").mockRejectedValue(
        new AppError(IdentityError.EmailDeliveryFailed),
      );

      const out = await http.call("POST", "/invitations", {
        token: admin.token,
        body: buildInvite(),
      });

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.EmailDeliveryFailed.code,
      });
    });
  });

  describe("GET /invitations", () => {
    it("lists the pending invitations, newest first, with 200", async () => {
      const http = createIdentityHttp();
      const admin = await signInAdmin(http);
      const first = await invite(http, admin.token);
      http.ctx.clock.advance(1_000);
      const second = await invite(http, admin.token);
      const accepted = await invite(http, admin.token);
      await accept(http, accepted.invitationToken);

      const out = await http.call("GET", "/invitations", {
        token: admin.token,
      });

      expect(out.status).toBe(200);
      expect(
        (out.body as { invitations: { id: string }[] }).invitations.map(
          (invitation) => invitation.id,
        ),
      ).toStrictEqual([second.invitationId, first.invitationId]);
    });

    it("answers 403 without the invite permission", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();

      const out = await http.call("GET", "/invitations", { token: ana.token });

      expect(out.status).toBe(403);
    });
  });

  describe("DELETE /invitations/:invitationId", () => {
    it("revokes an invitation with 204, so its link stops working", async () => {
      const http = createIdentityHttp();
      const admin = await signInAdmin(http);
      const { invitationId, invitationToken } = await invite(http, admin.token);

      const out = await http.call("DELETE", "/invitations/:invitationId", {
        token: admin.token,
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
      const admin = await signInAdmin(http);

      const out = await http.call("DELETE", "/invitations/:invitationId", {
        token: admin.token,
        params: { invitationId },
      });

      expect(out.status).toBe(status);
    });

    it("answers 403 without the invite permission", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();

      const out = await http.call("DELETE", "/invitations/:invitationId", {
        token: ana.token,
        params: { invitationId: faker.database.mongodbObjectId() },
      });

      expect(out.status).toBe(403);
    });

    it("answers 422 for an invitation already accepted", async () => {
      const http = createIdentityHttp();
      const admin = await signInAdmin(http);
      const { invitationId, invitationToken } = await invite(http, admin.token);
      await accept(http, invitationToken);

      const out = await http.call("DELETE", "/invitations/:invitationId", {
        token: admin.token,
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
      const admin = await signInAdmin(http);
      const { body, invitationToken } = await invite(http, admin.token);

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
      const admin = await signInAdmin(http);
      const { invitationToken } = await invite(http, admin.token);
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
