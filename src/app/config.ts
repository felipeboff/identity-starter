import { LogLevel } from "@shared/application/ports/logger";
import { v } from "@shared/application/validator";

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

export type Env = {
  NODE_ENV: NodeEnv;
  PORT: number;
  TRUST_PROXY: number;
  LOG_LEVEL: LogLevel;
  MONGO_URL: string;
  JWT_SECRET: string;
  APP_URL: URL;
  MAILER: MailerKind;
  MAIL_FROM_EMAIL: string;
  MAIL_FROM_NAME: string;
  MAILERSEND_API_KEY: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_REDIRECT_URI: URL;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: URL;
};

const envSchema = v.object<Env>({
  NODE_ENV: v.enum({ values: Object.values(NodeEnv), default: "develop" }),
  PORT: v.number({ integer: true, min: 1, max: 65_535, default: 3000 }),
  TRUST_PROXY: v.number({ integer: true, min: 0, default: 0 }),
  LOG_LEVEL: v.enum({ values: Object.values(LogLevel), default: "info" }),
  MONGO_URL: v.string({ trim: true, minLength: 1 }),
  JWT_SECRET: v.string({ minLength: 32 }),
  APP_URL: v.url({ default: new URL("http://localhost:3000") }),
  MAILER: v.enum({ values: Object.values(MailerKind), default: "log" }),
  MAIL_FROM_EMAIL: v.email(),
  MAIL_FROM_NAME: v.string({
    trim: true,
    minLength: 1,
    default: "Resolve Hub",
  }),
  MAILERSEND_API_KEY: v.string({ trim: true, minLength: 1 }),
  GITHUB_CLIENT_ID: v.string({ minLength: 20 }),
  GITHUB_CLIENT_SECRET: v.string({ minLength: 40 }),
  GITHUB_REDIRECT_URI: v.url(),
  GOOGLE_CLIENT_ID: v.string({ minLength: 30 }),
  GOOGLE_CLIENT_SECRET: v.string({ minLength: 30 }),
  GOOGLE_REDIRECT_URI: v.url(),
});

export type EnvSource = Readonly<Record<string, string | undefined>>;

export const loadEnv = (source: EnvSource): Env =>
  envSchema.probe({ ...source });

export const EXTERNAL_CALL_TIMEOUT_MS = 10_000;

export const toIdentitySettings = (env: Env): IdentitySettings => ({
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

export const env = loadEnv(process.env);
