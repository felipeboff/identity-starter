import { LogLevel } from "@shared/application/ports/logger";
import type { BasicAuthCredentials } from "@shared/infrastructure/http/basic-auth";
import { SchemaParser } from "@shared/presentation/schema-parser";
import Type from "typebox";

import type { IdentitySettings } from "@/identity/identity.module";

export const NodeEnv = {
  DEVELOP: "develop",
  PROD: "prod",
  TEST: "test",
} as const;

export type NodeEnv = (typeof NodeEnv)[keyof typeof NodeEnv];

export const MailerKind = {
  LOG: "log",
  MAILERSEND: "mailersend",
} as const;

export type MailerKind = (typeof MailerKind)[keyof typeof MailerKind];

const NOT_BLANK = "\\S";
const HTTP_URL = "^https?://[^\\s/?#]+\\S*$";

const toUrl = (value: string): URL => new URL(value);

const httpUrlSchema = Type.Codec(Type.String({ pattern: HTTP_URL }))
  .Decode(toUrl)
  .Encode(String);

const envSchema = Type.Object({
  APP_NAME: Type.String({ pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" }),
  NODE_ENV: Type.Enum(Object.values(NodeEnv), { default: NodeEnv.DEVELOP }),
  PORT: Type.Number({
    multipleOf: 1,
    minimum: 1,
    maximum: 65_535,
    default: 3000,
  }),
  TRUST_PROXY: Type.Number({ multipleOf: 1, minimum: 0, default: 0 }),
  LOG_LEVEL: Type.Enum(Object.values(LogLevel), { default: "info" }),
  MONGO_URL: Type.String({ pattern: NOT_BLANK }),
  REDIS_URL: Type.Codec(
    Type.String({
      pattern: "^rediss?://[^\\s/?#]+\\S*$",
      default: "redis://localhost:6379",
    }),
  )
    .Decode(toUrl)
    .Encode(String),
  RABBITMQ_URL: Type.Codec(
    Type.String({ pattern: "^amqps?://[^\\s/?#]+\\S*$" }),
  )
    .Decode(toUrl)
    .Encode(String),
  CORS_ORIGINS: Type.Array(httpUrlSchema, {
    minItems: 1,
    default: ["http://localhost:5173"],
  }),
  JWT_SECRET: Type.String({ minLength: 32 }),
  APP_URL: Type.Codec(
    Type.String({ pattern: HTTP_URL, default: "http://localhost:5173" }),
  )
    .Decode(toUrl)
    .Encode(String),
  MAILER: Type.Enum(Object.values(MailerKind), { default: MailerKind.LOG }),
  MAIL_FROM_EMAIL: Type.String({ format: "email" }),
  MAIL_FROM_NAME: Type.String({ pattern: NOT_BLANK }),
  MAILERSEND_API_KEY: Type.String({ pattern: NOT_BLANK }),
  GITHUB_CLIENT_ID: Type.String({ minLength: 20 }),
  GITHUB_CLIENT_SECRET: Type.String({ minLength: 40 }),
  GITHUB_REDIRECT_URI: httpUrlSchema,
  GOOGLE_CLIENT_ID: Type.String({ minLength: 30 }),
  GOOGLE_CLIENT_SECRET: Type.String({ minLength: 30 }),
  GOOGLE_REDIRECT_URI: httpUrlSchema,
  SENTRY_DSN: Type.Optional(Type.String({ pattern: HTTP_URL })),
  DOCS_USERNAME: Type.Optional(Type.String({ pattern: NOT_BLANK })),
  DOCS_PASSWORD: Type.Optional(Type.String({ minLength: 12 })),
});

export type Env = Type.StaticDecode<typeof envSchema>;

const parser = new SchemaParser();

export type EnvSource = Readonly<Record<string, string | undefined>>;

export const loadEnv = (source: EnvSource): Env =>
  parser.parse(envSchema, {
    ...source,
    CORS_ORIGINS: source.CORS_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ""),
  });

export const EXTERNAL_CALL_TIMEOUT_MS = 10_000;

export const toIdentitySettings = (env: Env): IdentitySettings => ({
  appName: env.APP_NAME,
  jwtSecret: env.JWT_SECRET,
  appUrl: env.APP_URL,
  externalCallTimeoutMs: EXTERNAL_CALL_TIMEOUT_MS,
  mailer: {
    kind: env.MAILER,
    apiKey: env.MAILERSEND_API_KEY,
    from: { email: env.MAIL_FROM_EMAIL, name: env.MAIL_FROM_NAME },
  },
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  },
  github: {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    redirectUri: env.GITHUB_REDIRECT_URI,
  },
});

export const toDocsCredentials = (env: Env): BasicAuthCredentials | null =>
  env.DOCS_USERNAME === undefined || env.DOCS_PASSWORD === undefined
    ? null
    : { username: env.DOCS_USERNAME, password: env.DOCS_PASSWORD };

export const env = loadEnv(process.env);
