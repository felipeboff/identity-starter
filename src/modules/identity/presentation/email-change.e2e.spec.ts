import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { describe, expect, it, vi } from "vitest";

import { IdentityHttp, createIdentityHttp } from "./testing/identity-http";

import { RateLimitPolicy } from "@/identity/application/rate-limit.policy";
import { seedAccount } from "@/identity/application/testing/identity-context";
import { EMAIL_CHANGE_TTL_MS } from "@/identity/application/token.policy";
import { IdentityError } from "@/identity/domain/errors/identity.error";

const failure = (out: { status: number; body?: unknown }) => ({
  status: out.status,
  code: (out.body as { code: string }).code,
});

const requestChange = async (http: IdentityHttp) => {
  const ana = await http.signIn();
  const newEmail = faker.internet.email().toLowerCase();
  const out = await http.call("POST", "/me/email", {
    token: ana.token,
    body: { newEmail, password: ana.password },
  });
  const token = http.ctx.mailer.emailChanges.at(-1)?.token ?? "";
  return { ana, newEmail, out, token };
};

describe("e-mail change", () => {
  describe("POST /me/email", () => {
    it("answers 204 and e-mails the link to the new address", async () => {
      const http = createIdentityHttp();

      const { out, newEmail } = await requestChange(http);

      expect(out.status).toBe(204);
      expect(http.ctx.mailer.emailChanges).toMatchObject([{ to: newEmail }]);
    });

    it("answers 400 for an e-mail another account uses", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      const bruno = await seedAccount(http.ctx);

      const out = await http.call("POST", "/me/email", {
        token: ana.token,
        body: { newEmail: bruno.email, password: ana.password },
      });

      expect(failure(out)).toStrictEqual({
        status: 400,
        code: IdentityError.AccountEmailTaken.code,
      });
    });

    it("answers 401 for a wrong password", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();

      const out = await http.call("POST", "/me/email", {
        token: ana.token,
        body: {
          newEmail: faker.internet.email(),
          password: faker.internet.password(),
        },
      });

      expect(failure(out)).toStrictEqual({
        status: 401,
        code: IdentityError.InvalidCredentials.code,
      });
    });

    it("answers 422 when the link cannot be delivered", async () => {
      const http = createIdentityHttp();
      vi.spyOn(http.ctx.mailer, "sendEmailChange").mockRejectedValue(
        new AppError(IdentityError.EmailDeliveryFailed),
      );

      const { out } = await requestChange(http);

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.EmailDeliveryFailed.code,
      });
    });

    it("answers 429 past the limit for one IP", async () => {
      const http = createIdentityHttp();
      const ana = await http.signIn();
      const ip = faker.internet.ip();
      const options = { token: ana.token, ip, body: {} };
      for (let i = 0; i < RateLimitPolicy.CHANGE_EMAIL_PER_IP.limit; i++) {
        await http.call("POST", "/me/email", options);
      }

      const out = await http.call("POST", "/me/email", options);

      expect(failure(out)).toStrictEqual({
        status: 429,
        code: SharedError.RateLimited.code,
      });
    });
  });

  describe("POST /auth/email-change", () => {
    it("moves the account with 200, signs it out and lets it sign in with the new e-mail", async () => {
      const http = createIdentityHttp();
      const { ana, newEmail, token } = await requestChange(http);

      const out = await http.call("POST", "/auth/email-change", {
        body: { token },
      });
      const oldSession = await http.call("GET", "/me", { token: ana.token });
      const signIn = await http.call("POST", "/auth/sign-in", {
        body: { email: newEmail, password: ana.password },
      });

      expect(out).toMatchObject({
        status: 200,
        body: { account: { email: newEmail } },
      });
      expect(oldSession.status).toBe(401);
      expect(signIn.status).toBe(200);
    });

    it("answers 400 without a token", async () => {
      const http = createIdentityHttp();

      const out = await http.call("POST", "/auth/email-change", { body: {} });

      expect(out.status).toBe(400);
    });

    it("answers 401 for an unknown token", async () => {
      const http = createIdentityHttp();

      const out = await http.call("POST", "/auth/email-change", {
        body: { token: faker.string.alphanumeric(43) },
      });

      expect(failure(out)).toStrictEqual({
        status: 401,
        code: IdentityError.InvalidEmailChangeToken.code,
      });
    });

    it("answers 422 once the link is over", async () => {
      const http = createIdentityHttp();
      const { token } = await requestChange(http);
      http.ctx.clock.advance(EMAIL_CHANGE_TTL_MS);

      const out = await http.call("POST", "/auth/email-change", {
        body: { token },
      });

      expect(failure(out)).toStrictEqual({
        status: 422,
        code: IdentityError.EmailChangeExpired.code,
      });
    });

    it("answers 429 past the limit for one IP", async () => {
      const http = createIdentityHttp();
      const ip = faker.internet.ip();
      const limit = RateLimitPolicy.CONFIRM_EMAIL_CHANGE_PER_IP.limit;
      for (let i = 0; i < limit; i++) {
        await http.call("POST", "/auth/email-change", { ip, body: {} });
      }

      const out = await http.call("POST", "/auth/email-change", {
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
