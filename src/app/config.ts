import { LogLevel } from "@shared/application/ports/logger";
import { v } from "@shared/application/validator";

export const NodeEnv = {
  DEVELOP: "develop",
  PROD: "prod",
  TEST: "test",
} as const;

export type NodeEnv = (typeof NodeEnv)[keyof typeof NodeEnv];

export type Env = {
  NODE_ENV: NodeEnv;
  PORT: number;
  TRUST_PROXY: number;
  LOG_LEVEL: LogLevel;
  MONGO_URL: string;
  JWT_SECRET: string;
  MAILERSEND_API_KEY: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
};

const envSchema = v.object<Env>({
  NODE_ENV: v.enum({ values: Object.values(NodeEnv), default: "develop" }),
  PORT: v.number({ integer: true, min: 1, max: 65_535, default: 3000 }),
  TRUST_PROXY: v.number({ integer: true, min: 0, default: 0 }),
  LOG_LEVEL: v.enum({ values: Object.values(LogLevel), default: "info" }),
  MONGO_URL: v.string({ trim: true, minLength: 1 }),
  JWT_SECRET: v.string({ minLength: 32 }),
  MAILERSEND_API_KEY: v.string({ trim: true, minLength: 1 }),
  GITHUB_CLIENT_ID: v.string({ minLength: 20 }),
  GITHUB_CLIENT_SECRET: v.string({ minLength: 40 }),
});

export const loadEnv = (
  source: Readonly<Record<string, string | undefined>>,
): Env => envSchema.probe({ ...source });

export const env = loadEnv(process.env);
