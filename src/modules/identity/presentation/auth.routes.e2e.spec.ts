import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityHttp, createIdentityHttp } from "./testing/identity-http";

import { IdentityOutboxEffect } from "@/identity/application/outbox/identity-outbox-effect";
import {
  recordedEmails,
  seedAccount,
} from "@/identity/application/testing/identity-context";
import { AuthProvider } from "@/identity/domain/credential.entity";

const TOKENS = {
  accessToken: expect.any(String) as unknown,
  refreshToken: expect.any(String) as unknown,
};

/** Google answers a fresh code with a fresh profile. */
const givenGoogleLogin = (http: IdentityHttp) => {
  const profile = {
    subject: faker.string.numeric(21),
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
  };
  const code = faker.string.alphanumeric(20);
  http.ctx.oauth.register(AuthProvider.GOOGLE, code, profile);
  return { profile, code };
};

const sessionOf = async (http: IdentityHttp, body: unknown) => {
  const { refreshToken } = body as { refreshToken: string };
  return http.ctx.sessions.findByTokenHash(http.ctx.tokens.hash(refreshToken));
};

describe("identity public routes", () => {
  it("signs up with 201", async () => {
    const http = createIdentityHttp();
    const email = faker.internet.email().toLowerCase();

    const out = await http.call("POST", "/auth/sign-up", {
      body: {
        name: faker.person.fullName(),
        email,
        password: faker.internet.password(),
      },
    });

    expect(out.status).toBe(201);
    expect(out.body).toEqual({
      account: expect.objectContaining({ email }) as unknown,
      ...TOKENS,
    });
  });

  it("signs in with 200", async () => {
    const http = createIdentityHttp();
    const ana = await seedAccount(http.ctx);

    const out = await http.call("POST", "/auth/sign-in", {
      body: { email: ana.email, password: ana.password },
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      account: expect.objectContaining({ id: ana.accountId }) as unknown,
      ...TOKENS,
    });
  });

  it("signs in with oauth with 200", async () => {
    const http = createIdentityHttp();
    const { profile, code } = givenGoogleLogin(http);

    const out = await http.call("POST", "/auth/oauth/:provider", {
      params: { provider: AuthProvider.GOOGLE },
      body: { code },
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      account: expect.objectContaining({ email: profile.email }) as unknown,
      isNewAccount: true,
      ...TOKENS,
    });
  });

  it("refreshes with 200", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();

    const out = await http.call("POST", "/auth/refresh", {
      body: { refreshToken: ana.refreshToken },
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      account: expect.objectContaining({ id: ana.accountId }) as unknown,
      ...TOKENS,
    });
  });

  it.each([
    [
      "sign-up",
      (http: IdentityHttp, ip: string, userAgent: string) =>
        http.call("POST", "/auth/sign-up", {
          body: {
            name: faker.person.fullName(),
            email: faker.internet.email(),
            password: faker.internet.password(),
          },
          ip,
          headers: { "user-agent": userAgent },
        }),
    ],
    [
      "sign-in",
      async (http: IdentityHttp, ip: string, userAgent: string) => {
        const ana = await seedAccount(http.ctx);
        return http.call("POST", "/auth/sign-in", {
          body: { email: ana.email, password: ana.password },
          ip,
          headers: { "user-agent": userAgent },
        });
      },
    ],
    [
      "oauth",
      (http: IdentityHttp, ip: string, userAgent: string) =>
        http.call("POST", "/auth/oauth/:provider", {
          params: { provider: AuthProvider.GOOGLE },
          body: { code: givenGoogleLogin(http).code },
          ip,
          headers: { "user-agent": userAgent },
        }),
    ],
    [
      "refresh",
      async (http: IdentityHttp, ip: string, userAgent: string) => {
        const ana = await http.signIn();
        return http.call("POST", "/auth/refresh", {
          body: { refreshToken: ana.refreshToken },
          ip,
          headers: { "user-agent": userAgent },
        });
      },
    ],
  ])(
    "stores the request ip and user agent on the session: %s",
    async (_, flow) => {
      const http = createIdentityHttp();
      const ip = faker.internet.ip();
      const userAgent = faker.internet.userAgent();

      const out = await flow(http, ip, userAgent);

      const session = await sessionOf(http, out.body);
      expect(session?.toSnapshot()).toMatchObject({ ipAddress: ip, userAgent });
    },
  );

  it("stores an empty user agent when the header is missing", async () => {
    const http = createIdentityHttp();
    const ana = await seedAccount(http.ctx);

    const out = await http.call("POST", "/auth/sign-in", {
      body: { email: ana.email, password: ana.password },
    });

    const session = await sessionOf(http, out.body);
    expect(session?.userAgent).toBe("");
  });

  it.each([
    ["a known email", true],
    ["an unknown email", false],
  ])("accepts a password reset request with 204: %s", async (_, known) => {
    const http = createIdentityHttp();
    const email = known
      ? (await seedAccount(http.ctx)).email
      : faker.internet.email().toLowerCase();

    const out = await http.call("POST", "/auth/password-reset/request", {
      body: { email },
    });

    expect(out).toStrictEqual({ status: 204 });
  });

  it("resets the password with 204", async () => {
    const http = createIdentityHttp();
    const ana = await seedAccount(http.ctx);
    await http.call("POST", "/auth/password-reset/request", {
      body: { email: ana.email },
    });
    const [mail] = recordedEmails(
      http.ctx,
      IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
    );
    const newPassword = faker.internet.password();

    const out = await http.call("POST", "/auth/password-reset", {
      body: { token: mail?.token, newPassword },
    });

    expect(out).toStrictEqual({ status: 204 });
    const signIn = await http.call("POST", "/auth/sign-in", {
      body: { email: ana.email, password: newPassword },
    });
    expect(signIn.status).toBe(200);
  });

  it("creates a password through the reset link for an account made with OAuth", async () => {
    const http = createIdentityHttp();
    const { profile, code } = givenGoogleLogin(http);
    await http.call("POST", "/auth/oauth/:provider", {
      params: { provider: AuthProvider.GOOGLE },
      body: { code },
    });
    await http.call("POST", "/auth/password-reset/request", {
      body: { email: profile.email },
    });
    const [mail] = recordedEmails(
      http.ctx,
      IdentityOutboxEffect.PASSWORD_RESET_EMAIL,
    );
    const newPassword = faker.internet.password();

    const out = await http.call("POST", "/auth/password-reset", {
      body: { token: mail?.token, newPassword },
    });

    expect(out).toStrictEqual({ status: 204 });
    const signIn = await http.call("POST", "/auth/sign-in", {
      body: { email: profile.email, password: newPassword },
    });
    expect(signIn.status).toBe(200);
  });

  it("verifies the email with 200", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    await http.call("POST", "/me/email-verification", { token: ana.token });
    const [mail] = recordedEmails(
      http.ctx,
      IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
    );

    const out = await http.call("POST", "/auth/email-verification", {
      body: { token: mail?.token },
    });

    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      account: expect.objectContaining({
        id: ana.accountId,
        emailVerifiedAt: http.ctx.clock.now().toISOString(),
      }) as unknown,
    });
  });

  it.each([
    [
      "sign-in with a wrong password",
      async (http: IdentityHttp) => {
        const ana = await seedAccount(http.ctx);
        return http.call("POST", "/auth/sign-in", {
          body: { email: ana.email, password: faker.internet.password() },
        });
      },
    ],
    [
      "refresh with an unknown token",
      (http: IdentityHttp) =>
        http.call("POST", "/auth/refresh", {
          body: { refreshToken: faker.string.alphanumeric(32) },
        }),
    ],
    [
      "password reset with an unknown token",
      (http: IdentityHttp) =>
        http.call("POST", "/auth/password-reset", {
          body: {
            token: faker.string.alphanumeric(32),
            newPassword: faker.internet.password(),
          },
        }),
    ],
    [
      "email verification with an unknown token",
      (http: IdentityHttp) =>
        http.call("POST", "/auth/email-verification", {
          body: { token: faker.string.alphanumeric(32) },
        }),
    ],
  ])("answers 401 on %s", async (_, attempt) => {
    const http = createIdentityHttp();

    const out = await attempt(http);

    expect(out.status).toBe(401);
  });
});
