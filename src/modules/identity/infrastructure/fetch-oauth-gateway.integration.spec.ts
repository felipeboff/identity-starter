import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { FetchHttpClient } from "@shared/infrastructure/http/fetch-http-client";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeLogger } from "@shared/testing/fake-logger";
import { describe, expect, it, vi } from "vitest";

import {
  FetchOAuthGateway,
  GITHUB_EMAILS_URL,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
} from "./fetch-oauth-gateway";
import { IdentityLogEvent } from "./identity.log-event";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

type Reply = Readonly<{ status: number; body: unknown }>;

const ok = (body: unknown): Reply => ({ status: 200, body });

const buildClient = () => ({
  clientId: faker.string.alphanumeric(20),
  clientSecret: faker.string.alphanumeric(40),
  redirectUri: new URL(faker.internet.url()),
});

const create = (replies: Readonly<Record<string, Reply>>) => {
  const fetch = vi.fn<typeof globalThis.fetch>((input) => {
    const reply = typeof input === "string" ? replies[input] : undefined;
    return reply
      ? Promise.resolve(
          new Response(JSON.stringify(reply.body), { status: reply.status }),
        )
      : Promise.reject(new TypeError(faker.lorem.sentence()));
  });
  const logger = new FakeLogger();
  const google = buildClient();
  const github = buildClient();
  const gateway = new FetchOAuthGateway({
    http: new FetchHttpClient({ timeoutMs: 1_000, fetch }),
    logger,
    google,
    github,
  });
  return { gateway, fetch, logger, google, github };
};

const requestTo = (
  fetch: ReturnType<typeof create>["fetch"],
  url: string,
): RequestInit | undefined =>
  fetch.mock.calls.find(([input]) => input === url)?.[1];

const formOf = (init: RequestInit | undefined) =>
  Object.fromEntries(new URLSearchParams(init?.body as string));

const buildCode = () => faker.string.alphanumeric(20);
const buildAccessToken = () => faker.string.alphanumeric(40);

const failureEntry = (fields: Record<string, unknown>) => ({
  level: LogLevel.ERROR,
  event: IdentityLogEvent.OAuthProviderFailed.name,
  fields,
});

describe("FetchOAuthGateway", () => {
  describe("google", () => {
    const provider = AuthProvider.GOOGLE;

    const buildUser = (overrides: Record<string, unknown> = {}) => ({
      sub: faker.string.numeric(21),
      email: faker.internet.email().toLowerCase(),
      email_verified: true,
      name: faker.person.fullName(),
      ...overrides,
    });

    const replies = (user: unknown, accessToken = buildAccessToken()) => ({
      [GOOGLE_TOKEN_URL]: ok({ access_token: accessToken }),
      [GOOGLE_USERINFO_URL]: ok(user),
    });

    it("trades the code for a token and reads the user", async () => {
      const user = buildUser();
      const accessToken = buildAccessToken();
      const { gateway, fetch, google } = create(replies(user, accessToken));
      const code = buildCode();

      const profile = await gateway.exchangeCode(provider, code);

      expect(profile).toStrictEqual({
        subject: user.sub,
        email: user.email,
        name: user.name,
      });
      expect(formOf(requestTo(fetch, GOOGLE_TOKEN_URL))).toStrictEqual({
        grant_type: "authorization_code",
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.redirectUri.href,
      });
      expect(requestTo(fetch, GOOGLE_USERINFO_URL)?.headers).toStrictEqual({
        authorization: `Bearer ${accessToken}`,
      });
    });

    it("uses the e-mail as the name when Google sends none", async () => {
      const user = buildUser({ name: undefined });
      const { gateway } = create(replies(user));

      const profile = await gateway.exchangeCode(provider, buildCode());

      expect(profile.name).toBe(user.email);
    });

    it("refuses an e-mail Google has not verified", async () => {
      const { gateway } = create(replies(buildUser({ email_verified: false })));

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthEmailNotVerified,
        { provider },
      );
    });

    it("rejects a code Google does not accept", async () => {
      const { gateway } = create({
        [GOOGLE_TOKEN_URL]: { status: 400, body: { error: "invalid_grant" } },
      });

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthCodeRejected,
        { provider },
      );
    });

    it("fails and logs Google's error when the token request is refused for another reason", async () => {
      const { gateway, logger } = create({
        [GOOGLE_TOKEN_URL]: {
          status: 400,
          body: { error: "redirect_uri_mismatch" },
        },
      });

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthProviderFailed,
        { provider },
      );

      expect(logger.entries).toStrictEqual([
        failureEntry({
          provider,
          step: "token",
          failure: "unexpected_status",
          status: 400,
          providerError: "redirect_uri_mismatch",
        }),
      ]);
    });

    it("fails when the user comes back in an unexpected shape", async () => {
      const { gateway, logger } = create(
        replies(buildUser({ sub: undefined })),
      );

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthProviderFailed,
        { provider },
      );

      expect(logger.entries).toStrictEqual([
        failureEntry({
          provider,
          step: "profile",
          failure: "unexpected_body",
          status: 200,
          providerError: undefined,
        }),
      ]);
    });

    it("fails when Google cannot be reached", async () => {
      const { gateway, logger } = create({});

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthProviderFailed,
        { provider },
      );

      expect(logger.entries).toStrictEqual([
        failureEntry({ provider, step: "token", failure: "network" }),
      ]);
    });
  });

  describe("github", () => {
    const provider = AuthProvider.GITHUB;

    const buildUser = (overrides: Record<string, unknown> = {}) => ({
      id: faker.number.int({ min: 1, max: 999_999_999 }),
      login: faker.internet.username(),
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      ...overrides,
    });

    const buildEmail = (overrides: Record<string, unknown> = {}) => ({
      email: faker.internet.email().toLowerCase(),
      primary: false,
      verified: true,
      ...overrides,
    });

    const replies = (
      user: unknown,
      accessToken = buildAccessToken(),
    ): Record<string, Reply> => ({
      [GITHUB_TOKEN_URL]: ok({
        access_token: accessToken,
        token_type: "bearer",
      }),
      [GITHUB_USER_URL]: ok(user),
    });

    it("trades the code for a token and reads the user by its numeric id", async () => {
      const user = buildUser();
      const accessToken = buildAccessToken();
      const { gateway, fetch, github } = create(replies(user, accessToken));
      const code = buildCode();

      const profile = await gateway.exchangeCode(provider, code);

      expect(profile).toStrictEqual({
        subject: String(user.id),
        email: user.email,
        name: user.name,
      });
      expect(requestTo(fetch, GITHUB_TOKEN_URL)?.headers).toMatchObject({
        accept: "application/json",
      });
      expect(formOf(requestTo(fetch, GITHUB_TOKEN_URL))).toStrictEqual({
        client_id: github.clientId,
        client_secret: github.clientSecret,
        code,
        redirect_uri: github.redirectUri.href,
      });
      expect(requestTo(fetch, GITHUB_USER_URL)?.headers).toStrictEqual({
        accept: "application/vnd.github+json",
        authorization: `Bearer ${accessToken}`,
        "user-agent": "resolve-hub",
        "x-github-api-version": "2022-11-28",
      });
      expect(requestTo(fetch, GITHUB_EMAILS_URL)).toBeUndefined();
    });

    it.each([
      ["null", null],
      ["blank", "   "],
    ])("uses the login as the name when it is %s", async (_, name) => {
      const user = buildUser({ name });
      const { gateway } = create(replies(user));

      const profile = await gateway.exchangeCode(provider, buildCode());

      expect(profile.name).toBe(user.login);
    });

    it("reads the primary verified e-mail when the profile e-mail is private", async () => {
      const primary = buildEmail({ primary: true });
      const { gateway } = create({
        ...replies(buildUser({ email: null })),
        [GITHUB_EMAILS_URL]: ok([buildEmail(), primary]),
      });

      const profile = await gateway.exchangeCode(provider, buildCode());

      expect(profile.email).toBe(primary.email);
    });

    it.each([
      ["no e-mail is primary", [buildEmail()]],
      [
        "the primary e-mail is not verified",
        [buildEmail({ primary: true, verified: false })],
      ],
      ["there is no e-mail", []],
    ])("refuses the user when %s", async (_, emails) => {
      const { gateway } = create({
        ...replies(buildUser({ email: null })),
        [GITHUB_EMAILS_URL]: ok(emails),
      });

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthEmailNotVerified,
        { provider },
      );
    });

    it("rejects a code GitHub does not accept", async () => {
      const { gateway } = create({
        [GITHUB_TOKEN_URL]: ok({ error: "bad_verification_code" }),
      });

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthCodeRejected,
        { provider },
      );
    });

    it("fails and logs GitHub's error when the token request is refused for another reason", async () => {
      const { gateway, logger } = create({
        [GITHUB_TOKEN_URL]: ok({ error: "incorrect_client_credentials" }),
      });

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthProviderFailed,
        { provider },
      );

      expect(logger.entries).toStrictEqual([
        failureEntry({
          provider,
          step: "token",
          failure: "unexpected_body",
          status: 200,
          providerError: "incorrect_client_credentials",
        }),
      ]);
    });

    it("fails when the user cannot be read", async () => {
      const { gateway, logger } = create({
        ...replies(buildUser()),
        [GITHUB_USER_URL]: {
          status: 401,
          body: { message: faker.lorem.sentence() },
        },
      });

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthProviderFailed,
        { provider },
      );

      expect(logger.entries).toStrictEqual([
        failureEntry({
          provider,
          step: "profile",
          failure: "unexpected_status",
          status: 401,
          providerError: undefined,
        }),
      ]);
    });

    it("fails when the e-mails cannot be read", async () => {
      const { gateway, logger } = create(replies(buildUser({ email: null })));

      await expectAppError(
        gateway.exchangeCode(provider, buildCode()),
        IdentityError.OAuthProviderFailed,
        { provider },
      );

      expect(logger.entries).toStrictEqual([
        failureEntry({ provider, step: "emails", failure: "network" }),
      ]);
    });
  });

  it("refuses Apple, which has no client yet, without calling anyone", async () => {
    const { gateway, fetch } = create({});

    await expectAppError(
      gateway.exchangeCode(AuthProvider.APPLE, buildCode()),
      IdentityError.OAuthProviderNotSupported,
      { provider: AuthProvider.APPLE },
    );

    expect(fetch).not.toHaveBeenCalled();
  });
});
