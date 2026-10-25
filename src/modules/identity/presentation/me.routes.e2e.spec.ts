import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityHttp, createIdentityHttp } from "./testing/identity-http";

import {
  seedAccount,
  seedSession,
} from "@/identity/application/testing/identity-context";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

const saveGoogleCredential = async (http: IdentityHttp, accountId: string) => {
  const credential = Credential.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      provider: AuthProvider.GOOGLE,
      subject: faker.string.numeric(21),
    },
    http.ctx.clock.now(),
  );
  await http.ctx.credentials.save(credential);
  return credential;
};

describe("identity protected routes", () => {
  it("signs out with 204", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();

    const out = await http.call("POST", "/auth/sign-out", { token: ana.token });

    expect(out).toStrictEqual({ status: 204 });
    const session = await http.ctx.sessions.findById(ana.session.id.value);
    expect(session?.isRevoked()).toBe(true);
  });

  it("gets me with 200", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();

    const out = await http.call("GET", "/me", { token: ana.token });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      account: expect.objectContaining({
        id: ana.accountId,
        email: ana.email,
      }) as unknown,
      membership: JSON.parse(
        JSON.stringify(ana.membership.toSnapshot()),
      ) as unknown,
    });
  });

  it("renames me with 200", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    const name = faker.person.fullName();

    const out = await http.call("PATCH", "/me", {
      token: ana.token,
      body: { name },
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      account: expect.objectContaining({ id: ana.accountId, name }) as unknown,
    });
  });

  it("changes my password with 204", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    const newPassword = faker.internet.password();

    const out = await http.call("PUT", "/me/password", {
      token: ana.token,
      body: { oldPassword: ana.password, newPassword },
    });

    expect(out).toStrictEqual({ status: 204 });
    const signIn = await http.call("POST", "/auth/sign-in", {
      body: { email: ana.email, password: newPassword },
    });
    expect(signIn.status).toBe(200);
  });

  it("requests an email verification with 204", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();

    const out = await http.call("POST", "/me/email-verification", {
      token: ana.token,
    });

    expect(out).toStrictEqual({ status: 204 });
    expect(http.ctx.mailer.emailVerifications).toEqual([
      expect.objectContaining({ to: ana.email }),
    ]);
  });

  it("lists my sessions with 200", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();

    const out = await http.call("GET", "/me/sessions", { token: ana.token });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      sessions: [
        expect.objectContaining({ id: ana.session.id.value }) as unknown,
      ],
    });
  });

  it("links an oauth provider with 201", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    const code = faker.string.alphanumeric(20);
    http.ctx.oauth.register(AuthProvider.GOOGLE, code, {
      subject: faker.string.numeric(21),
      email: ana.email,
      name: faker.person.fullName(),
    });

    const out = await http.call("POST", "/me/oauth/:provider", {
      token: ana.token,
      params: { provider: AuthProvider.GOOGLE },
      body: { code },
    });

    expect(out.status).toBe(201);
    expect(out.body).toEqual({
      credential: expect.objectContaining({
        accountId: ana.accountId,
        provider: AuthProvider.GOOGLE,
      }) as unknown,
    });
  });

  it("unlinks an oauth provider with 204", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    const google = await saveGoogleCredential(http, ana.accountId);

    const out = await http.call("DELETE", "/me/oauth/:provider", {
      token: ana.token,
      params: { provider: AuthProvider.GOOGLE },
    });

    expect(out).toStrictEqual({ status: 204 });
    const stored = await http.ctx.credentials.findById(google.id.value);
    expect(stored?.isDeleted()).toBe(true);
  });

  it("revokes a session with 204", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    const { session: other } = await seedSession(http.ctx, ana);

    const out = await http.call("DELETE", "/sessions/:sessionId", {
      token: ana.token,
      params: { sessionId: other.id.value },
    });

    expect(out).toStrictEqual({ status: 204 });
    const stored = await http.ctx.sessions.findById(other.id.value);
    expect(stored?.isRevoked()).toBe(true);
  });

  it("revokes all sessions with 200", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    await seedSession(http.ctx, ana);

    const out = await http.call("DELETE", "/accounts/:accountId/sessions", {
      token: ana.token,
      params: { accountId: ana.accountId },
    });

    expect(out.status).toBe(200);
    expect(out.body).toStrictEqual({ revokedCount: 2 });
  });

  it("deactivates an account with 204", async () => {
    const http = createIdentityHttp();
    const admin = await http.signIn({ role: MembershipRole.ADMIN });
    const bruno = await seedAccount(http.ctx);

    const out = await http.call("POST", "/accounts/:accountId/deactivate", {
      token: admin.token,
      params: { accountId: bruno.accountId },
    });

    expect(out).toStrictEqual({ status: 204 });
    const account = await http.ctx.accounts.findById(bruno.accountId);
    expect(account?.isDeleted()).toBe(true);
  });

  it("reactivates an account with 200", async () => {
    const http = createIdentityHttp();
    const admin = await http.signIn({ role: MembershipRole.ADMIN });
    const bruno = await seedAccount(http.ctx);
    bruno.account.markAsDeleted(http.ctx.clock.now());
    await http.ctx.accounts.save(bruno.account);

    const out = await http.call("POST", "/accounts/:accountId/reactivate", {
      token: admin.token,
      params: { accountId: bruno.accountId },
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      account: expect.objectContaining({
        id: bruno.accountId,
        deletedAt: null,
      }) as unknown,
    });
  });

  it("changes a member role with 200", async () => {
    const http = createIdentityHttp();
    const admin = await http.signIn({ role: MembershipRole.ADMIN });
    const bruno = await seedAccount(http.ctx);

    const out = await http.call("PUT", "/members/:accountId/role", {
      token: admin.token,
      params: { accountId: bruno.accountId },
      body: { role: MembershipRole.ADMIN },
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      membership: expect.objectContaining({
        id: bruno.membership.id.value,
        role: MembershipRole.ADMIN,
      }) as unknown,
    });
  });

  it("changes member permissions with 200", async () => {
    const http = createIdentityHttp();
    const admin = await http.signIn({ role: MembershipRole.ADMIN });
    const bruno = await seedAccount(http.ctx);
    const permissions = [MembershipPermission.READ, MembershipPermission.WRITE];

    const out = await http.call("PUT", "/members/:accountId/permissions", {
      token: admin.token,
      params: { accountId: bruno.accountId },
      body: { permissions },
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      membership: expect.objectContaining({
        id: bruno.membership.id.value,
        permissions,
      }) as unknown,
    });
  });
});
