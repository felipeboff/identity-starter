import { faker } from "@faker-js/faker";
import type { RateLimitRule } from "@shared/application/services/rate-limiter";
import { SharedError } from "@shared/domain/errors/shared.error";
import type { HttpMethod } from "@shared/presentation/http/http-route";
import { describe, expect, it } from "vitest";

import { createIdentityHttp } from "./testing/identity-http";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
import { RateLimitPolicy } from "@/identity/application/rate-limit.policy";
import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

type LimitedRoute = [HttpMethod, string, RateLimitRule, boolean];

const LIMITED_ROUTES: LimitedRoute[] = [
  ["POST", "/auth/sign-up", RateLimitPolicy.SIGN_UP_PER_IP, false],
  ["POST", "/auth/sign-in", RateLimitPolicy.SIGN_IN_PER_IP, false],
  ["POST", "/auth/oauth/:provider", RateLimitPolicy.OAUTH_PER_IP, false],
  ["POST", "/auth/refresh", RateLimitPolicy.REFRESH_PER_IP, false],
  [
    "POST",
    "/auth/password-reset/request",
    RateLimitPolicy.PASSWORD_RESET_REQUEST_PER_IP,
    false,
  ],
  [
    "POST",
    "/auth/password-reset",
    RateLimitPolicy.PASSWORD_RESET_PER_IP,
    false,
  ],
  [
    "POST",
    "/auth/email-verification",
    RateLimitPolicy.EMAIL_VERIFICATION_PER_IP,
    false,
  ],
  ["PUT", "/me/password", RateLimitPolicy.CHANGE_PASSWORD_PER_IP, true],
  [
    "POST",
    "/me/email-verification",
    RateLimitPolicy.EMAIL_VERIFICATION_REQUEST_PER_IP,
    true,
  ],
  ["POST", "/me/oauth/:provider", RateLimitPolicy.OAUTH_PER_IP, true],
];

const failure = (out: { status: number; body?: unknown }) => ({
  status: out.status,
  code: (out.body as { code: string }).code,
});

const violatedFields = (out: { body?: unknown }) =>
  (
    out.body as { data: { violations: { field: string }[] } }
  ).data.violations.map((violation) => violation.field);

describe("identity security", () => {
  it.each(LIMITED_ROUTES)(
    "answers 429 on %s %s past the limit for one IP",
    async (method, path, rule, authenticated) => {
      const http = createIdentityHttp();
      const token = authenticated ? (await http.signIn()).token : undefined;
      const ip = faker.internet.ip();
      const options = {
        ip,
        token,
        params: { provider: AuthProvider.GOOGLE },
        body: {},
      };
      for (let i = 0; i < rule.limit; i++) {
        await http.call(method, path, options);
      }

      const out = await http.call(method, path, options);
      const otherIp = await http.call(method, path, {
        ...options,
        ip: faker.internet.ipv6(),
      });

      expect(failure(out)).toStrictEqual({
        status: 429,
        code: SharedError.RateLimited.code,
      });
      expect(otherIp.status).not.toBe(429);
    },
  );

  it("locks sign-in for an e-mail after too many wrong passwords", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();
    const limit = RateLimitPolicy.SIGN_IN_FAILURES_PER_EMAIL.limit;
    for (let i = 0; i < limit; i++) {
      await http.call("POST", "/auth/sign-in", {
        ip: faker.internet.ipv6(),
        body: { email: ana.email, password: faker.internet.password() },
      });
    }

    const out = await http.call("POST", "/auth/sign-in", {
      ip: faker.internet.ipv6(),
      body: { email: ana.email, password: ana.password },
    });

    expect(failure(out)).toStrictEqual({
      status: 429,
      code: IdentityError.SignInLocked.code,
    });
  });

  it("locks sign-in for an e-mail with no account after too many attempts", async () => {
    const http = createIdentityHttp();
    const email = faker.internet.email().toLowerCase();
    const rule = RateLimitPolicy.SIGN_IN_FAILURES_PER_EMAIL;
    for (let i = 0; i < rule.limit; i++) {
      await http.call("POST", "/auth/sign-in", {
        ip: faker.internet.ipv6(),
        body: { email, password: faker.internet.password() },
      });
    }

    const out = await http.call("POST", "/auth/sign-in", {
      ip: faker.internet.ipv6(),
      body: { email, password: faker.internet.password() },
    });

    expect(out.status).toBe(429);
    expect(out.body).toMatchObject({
      code: IdentityError.SignInLocked.code,
      data: { retryAfterSeconds: rule.windowMs / 1000 },
    });
  });

  it.each([
    ["shorter than the minimum", PASSWORD_MIN_LENGTH - 1],
    ["longer than the maximum", PASSWORD_MAX_LENGTH + 1],
  ])("refuses a sign-up password %s", async (_, length) => {
    const http = createIdentityHttp();

    const out = await http.call("POST", "/auth/sign-up", {
      body: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: faker.string.alphanumeric(length),
      },
    });

    expect(out.status).toBe(400);
    expect(violatedFields(out)).toStrictEqual(["password"]);
  });

  it("refuses a PKCE code verifier shorter than 43 characters", async () => {
    const http = createIdentityHttp();

    const out = await http.call("POST", "/auth/oauth/:provider", {
      params: { provider: AuthProvider.GOOGLE },
      body: {
        code: faker.string.alphanumeric(20),
        codeVerifier: faker.string.alphanumeric({
          length: { min: 1, max: 42 },
        }),
      },
    });

    expect(out.status).toBe(400);
    expect(violatedFields(out)).toStrictEqual(["codeVerifier"]);
  });

  it("hands a valid PKCE code verifier to the provider", async () => {
    const http = createIdentityHttp();
    const code = faker.string.alphanumeric(20);
    const codeVerifier = faker.string.alphanumeric(64);
    http.ctx.oauth.register(AuthProvider.GOOGLE, code, {
      subject: faker.string.numeric(21),
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
    });

    const out = await http.call("POST", "/auth/oauth/:provider", {
      params: { provider: AuthProvider.GOOGLE },
      body: { code, codeVerifier },
    });

    expect(out.status).toBe(200);
    expect(http.ctx.oauth.exchanges).toStrictEqual([
      { provider: AuthProvider.GOOGLE, code, codeVerifier },
    ]);
  });
});
