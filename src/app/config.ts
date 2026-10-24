import { v } from "@shared/application/validator";

export type Env = {
  PORT: number;
  MONGO_URL: string;
  JWT_SECRET: string;
  MAILERSEND_API_KEY: string;
};

const required = () => v.string({ trim: true, minLength: 1 });

const envSchema = v.object<Env>({
  PORT: v.number({ integer: true, min: 1, max: 65_535 }),
  MONGO_URL: required(),
  // HS256 needs a key of at least 256 bits.
  JWT_SECRET: v.string({ minLength: 32 }),
  MAILERSEND_API_KEY: required(),
});

/** Reads the environment once at startup; throws `shared.input_invalid` naming every bad variable. */
export const loadEnv = (
  source: Readonly<Record<string, string | undefined>>,
): Env =>
  // process.env is built by a native constructor, so `v.object` treats it like a class instance.
  envSchema.probe({ ...source });

export const env = loadEnv(process.env);
