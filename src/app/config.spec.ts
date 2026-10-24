import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { describe, expect, it, vi } from "vitest";

import type { NodeEnv as NodeEnvType } from "./config";

const NODE_ENVS: NodeEnvType[] = ["develop", "prod", "test"];

const buildSource = (overrides: Record<string, string | undefined> = {}) => ({
  NODE_ENV: faker.helpers.arrayElement(NODE_ENVS),
  PORT: String(faker.number.int({ min: 1, max: 65_535 })),
  TRUST_PROXY: String(faker.number.int({ min: 0, max: 3 })),
  LOG_LEVEL: faker.helpers.arrayElement(Object.values(LogLevel)),
  MONGO_URL: faker.internet.url(),
  JWT_SECRET: faker.string.alphanumeric(64),
  MAILERSEND_API_KEY: faker.string.alphanumeric(40),
  ...overrides,
});

const processEnv = buildSource();
for (const [name, value] of Object.entries(processEnv)) vi.stubEnv(name, value);

const { env, loadEnv, NodeEnv } = await import("./config");

describe("env", () => {
  it("is the process environment, read once at import", () => {
    expect(env).toStrictEqual({
      ...processEnv,
      PORT: Number(processEnv.PORT),
      TRUST_PROXY: Number(processEnv.TRUST_PROXY),
    });
  });
});

describe("NodeEnv", () => {
  it("lists the environments the app runs in", () => {
    expect(Object.values(NodeEnv)).toStrictEqual(NODE_ENVS);
  });
});

describe("loadEnv", () => {
  it("reads a valid environment, with PORT as a number", () => {
    const source = buildSource();

    const env = loadEnv(source);

    expect(env).toStrictEqual({
      ...source,
      PORT: Number(source.PORT),
      TRUST_PROXY: Number(source.TRUST_PROXY),
    });
  });

  it("defaults NODE_ENV, PORT, TRUST_PROXY and LOG_LEVEL when they are missing", () => {
    const source = buildSource({
      NODE_ENV: undefined,
      PORT: undefined,
      TRUST_PROXY: undefined,
      LOG_LEVEL: undefined,
    });

    const env = loadEnv(source);

    expect(env).toMatchObject({
      NODE_ENV: NodeEnv.DEVELOP,
      PORT: 3000,
      TRUST_PROXY: 0,
      LOG_LEVEL: LogLevel.INFO,
    });
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
      "JWT_SECRET shorter than 32",
      {
        JWT_SECRET: faker.string.alphanumeric({ length: { min: 1, max: 31 } }),
      },
      "JWT_SECRET",
    ],
    [
      "MAILERSEND_API_KEY empty",
      { MAILERSEND_API_KEY: "" },
      "MAILERSEND_API_KEY",
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
            expect.objectContaining({ field: "MAILERSEND_API_KEY" }),
          ],
        },
      }),
    );
  });
});
