import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { describe, expect, it, vi } from "vitest";

import type {
  MailerKind as MailerKindType,
  NodeEnv as NodeEnvType,
} from "./config";

const NODE_ENVS: NodeEnvType[] = ["develop", "prod", "test"];
const MAILER_KINDS: MailerKindType[] = ["log", "mailersend"];

const buildSource = (overrides: Record<string, string | undefined> = {}) => ({
  NODE_ENV: faker.helpers.arrayElement(NODE_ENVS),
  PORT: String(faker.number.int({ min: 1, max: 65_535 })),
  TRUST_PROXY: String(faker.number.int({ min: 0, max: 3 })),
  LOG_LEVEL: faker.helpers.arrayElement(Object.values(LogLevel)),
  MONGO_URL: faker.internet.url(),
  REDIS_URL: `redis://${faker.internet.domainName()}:${faker.number.int({ min: 1_024, max: 65_535 })}`,
  JWT_SECRET: faker.string.alphanumeric(64),
  APP_URL: faker.internet.url(),
  MAILER: faker.helpers.arrayElement(MAILER_KINDS),
  MAIL_FROM_EMAIL: faker.internet.email().toLowerCase(),
  MAIL_FROM_NAME: faker.company.name(),
  MAILERSEND_API_KEY: faker.string.alphanumeric(40),
  GITHUB_CLIENT_ID: faker.string.alphanumeric(20),
  GITHUB_CLIENT_SECRET: faker.string.hexadecimal({ length: 40, prefix: "" }),
  GITHUB_REDIRECT_URI: faker.internet.url(),
  GOOGLE_CLIENT_ID: `${faker.string.numeric(12)}-${faker.string.alphanumeric(32)}.apps.googleusercontent.com`,
  GOOGLE_CLIENT_SECRET: `GOCSPX-${faker.string.alphanumeric(28)}`,
  GOOGLE_REDIRECT_URI: faker.internet.url(),
  ...overrides,
});

const processEnv = buildSource();
for (const [name, value] of Object.entries(processEnv)) vi.stubEnv(name, value);

const {
  env,
  EXTERNAL_CALL_TIMEOUT_MS,
  loadEnv,
  MailerKind,
  NodeEnv,
  toIdentitySettings,
} = await import("./config");

describe("env", () => {
  it("is the process environment, read once at import", () => {
    expect(env).toStrictEqual({
      ...processEnv,
      PORT: Number(processEnv.PORT),
      TRUST_PROXY: Number(processEnv.TRUST_PROXY),
      REDIS_URL: new URL(processEnv.REDIS_URL),
      APP_URL: new URL(processEnv.APP_URL),
      GITHUB_REDIRECT_URI: new URL(processEnv.GITHUB_REDIRECT_URI),
      GOOGLE_REDIRECT_URI: new URL(processEnv.GOOGLE_REDIRECT_URI),
    });
  });
});

describe("toIdentitySettings", () => {
  it("groups what the identity module needs from the environment", () => {
    const source = loadEnv(buildSource());

    expect(toIdentitySettings(source)).toStrictEqual({
      jwtSecret: source.JWT_SECRET,
      appUrl: source.APP_URL,
      externalCallTimeoutMs: EXTERNAL_CALL_TIMEOUT_MS,
      mailer: {
        kind: source.MAILER,
        apiKey: source.MAILERSEND_API_KEY,
        from: { email: source.MAIL_FROM_EMAIL, name: source.MAIL_FROM_NAME },
      },
      google: {
        clientId: source.GOOGLE_CLIENT_ID,
        clientSecret: source.GOOGLE_CLIENT_SECRET,
        redirectUri: source.GOOGLE_REDIRECT_URI,
      },
      github: {
        clientId: source.GITHUB_CLIENT_ID,
        clientSecret: source.GITHUB_CLIENT_SECRET,
        redirectUri: source.GITHUB_REDIRECT_URI,
      },
    });
  });
});

describe("NodeEnv", () => {
  it("lists the environments the app runs in", () => {
    expect(Object.values(NodeEnv)).toStrictEqual(NODE_ENVS);
  });
});

describe("MailerKind", () => {
  it("lists the mailers the app can use", () => {
    expect(Object.values(MailerKind)).toStrictEqual(MAILER_KINDS);
  });
});

describe("loadEnv", () => {
  it("reads a valid environment, with numbers and URLs parsed", () => {
    const source = buildSource();

    const env = loadEnv(source);

    expect(env).toStrictEqual({
      ...source,
      PORT: Number(source.PORT),
      TRUST_PROXY: Number(source.TRUST_PROXY),
      REDIS_URL: new URL(source.REDIS_URL),
      APP_URL: new URL(source.APP_URL),
      GITHUB_REDIRECT_URI: new URL(source.GITHUB_REDIRECT_URI),
      GOOGLE_REDIRECT_URI: new URL(source.GOOGLE_REDIRECT_URI),
    });
  });

  it("defaults the optional variables when they are missing", () => {
    const source = buildSource({
      NODE_ENV: undefined,
      PORT: undefined,
      TRUST_PROXY: undefined,
      LOG_LEVEL: undefined,
      REDIS_URL: undefined,
      APP_URL: undefined,
      MAILER: undefined,
      MAIL_FROM_NAME: undefined,
    });

    const env = loadEnv(source);

    expect(env).toMatchObject({
      NODE_ENV: NodeEnv.DEVELOP,
      PORT: 3000,
      TRUST_PROXY: 0,
      LOG_LEVEL: LogLevel.INFO,
      MAILER: MailerKind.LOG,
      MAIL_FROM_NAME: "Resolve Hub",
    });
    expect(env.REDIS_URL.href).toBe("redis://localhost:6379");
    expect(env.APP_URL.href).toBe("http://localhost:3000/");
  });

  it("ignores variables it does not know", () => {
    const unknownName = faker.string.alpha({ length: 12, casing: "upper" });

    const env = loadEnv({
      ...buildSource(),
      [unknownName]: faker.lorem.word(),
    });

    expect(env).not.toHaveProperty(unknownName);
  });

  it.each([
    ["NODE_ENV unknown", { NODE_ENV: faker.string.alpha(12) }, "NODE_ENV"],
    ["LOG_LEVEL unknown", { LOG_LEVEL: faker.string.alpha(12) }, "LOG_LEVEL"],
    ["PORT not a number", { PORT: faker.lorem.word() }, "PORT"],
    [
      "PORT not an integer",
      { PORT: `${faker.number.int({ min: 1, max: 65_534 })}.5` },
      "PORT",
    ],
    [
      "PORT out of range",
      { PORT: String(faker.number.int({ min: 65_536, max: 999_999 })) },
      "PORT",
    ],
    [
      "TRUST_PROXY negative",
      { TRUST_PROXY: String(-faker.number.int({ min: 1, max: 9 })) },
      "TRUST_PROXY",
    ],
    ["MONGO_URL empty", { MONGO_URL: "" }, "MONGO_URL"],
    ["MONGO_URL blank", { MONGO_URL: "   " }, "MONGO_URL"],
    [
      "REDIS_URL not a redis URL",
      { REDIS_URL: faker.internet.url() },
      "REDIS_URL",
    ],
    [
      "JWT_SECRET shorter than 32",
      {
        JWT_SECRET: faker.string.alphanumeric({ length: { min: 1, max: 31 } }),
      },
      "JWT_SECRET",
    ],
    ["APP_URL not a URL", { APP_URL: faker.lorem.word() }, "APP_URL"],
    ["MAILER unknown", { MAILER: faker.string.alpha(12) }, "MAILER"],
    [
      "MAIL_FROM_EMAIL not an e-mail",
      { MAIL_FROM_EMAIL: faker.lorem.word() },
      "MAIL_FROM_EMAIL",
    ],
    ["MAIL_FROM_NAME blank", { MAIL_FROM_NAME: "   " }, "MAIL_FROM_NAME"],
    [
      "GITHUB_REDIRECT_URI not a URL",
      { GITHUB_REDIRECT_URI: faker.lorem.word() },
      "GITHUB_REDIRECT_URI",
    ],
    [
      "GOOGLE_REDIRECT_URI not a URL",
      { GOOGLE_REDIRECT_URI: faker.lorem.word() },
      "GOOGLE_REDIRECT_URI",
    ],
    [
      "MAILERSEND_API_KEY empty",
      { MAILERSEND_API_KEY: "" },
      "MAILERSEND_API_KEY",
    ],
    [
      "GITHUB_CLIENT_ID shorter than 20",
      {
        GITHUB_CLIENT_ID: faker.string.alphanumeric({
          length: { min: 1, max: 19 },
        }),
      },
      "GITHUB_CLIENT_ID",
    ],
    [
      "GITHUB_CLIENT_SECRET shorter than 40",
      {
        GITHUB_CLIENT_SECRET: faker.string.alphanumeric({
          length: { min: 1, max: 39 },
        }),
      },
      "GITHUB_CLIENT_SECRET",
    ],
    [
      "GOOGLE_CLIENT_ID shorter than 30",
      {
        GOOGLE_CLIENT_ID: faker.string.alphanumeric({
          length: { min: 1, max: 29 },
        }),
      },
      "GOOGLE_CLIENT_ID",
    ],
    [
      "GOOGLE_CLIENT_SECRET shorter than 30",
      {
        GOOGLE_CLIENT_SECRET: faker.string.alphanumeric({
          length: { min: 1, max: 29 },
        }),
      },
      "GOOGLE_CLIENT_SECRET",
    ],
  ])("refuses %s", (_, overrides, field) => {
    expect(() => loadEnv(buildSource(overrides))).toThrow(
      expect.objectContaining({
        code: SharedError.InputInvalid.code,
        data: {
          violations: [expect.objectContaining({ field })],
        },
      }),
    );
  });

  it("names every missing required variable at once", () => {
    expect(() => loadEnv({})).toThrow(
      expect.objectContaining({
        code: SharedError.InputInvalid.code,
        data: {
          violations: [
            expect.objectContaining({ field: "MONGO_URL" }),
            expect.objectContaining({ field: "JWT_SECRET" }),
            expect.objectContaining({ field: "MAIL_FROM_EMAIL" }),
            expect.objectContaining({ field: "MAILERSEND_API_KEY" }),
            expect.objectContaining({ field: "GITHUB_CLIENT_ID" }),
            expect.objectContaining({ field: "GITHUB_CLIENT_SECRET" }),
            expect.objectContaining({ field: "GITHUB_REDIRECT_URI" }),
            expect.objectContaining({ field: "GOOGLE_CLIENT_ID" }),
            expect.objectContaining({ field: "GOOGLE_CLIENT_SECRET" }),
            expect.objectContaining({ field: "GOOGLE_REDIRECT_URI" }),
          ],
        },
      }),
    );
  });
});
