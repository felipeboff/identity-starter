import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { describe, expect, it, vi } from "vitest";

const buildSource = (overrides: Record<string, string | undefined> = {}) => ({
  PORT: String(faker.number.int({ min: 1, max: 65_535 })),
  MONGO_URL: faker.internet.url(),
  JWT_SECRET: faker.string.alphanumeric(64),
  MAILERSEND_API_KEY: faker.string.alphanumeric(40),
  ...overrides,
});

// Importing the config reads process.env, so it must be valid before the import runs.
const processEnv = buildSource();
for (const [name, value] of Object.entries(processEnv)) vi.stubEnv(name, value);

const { env, loadEnv } = await import("./config");

describe("env", () => {
  it("is the process environment, read once at import", () => {
    expect(env).toStrictEqual({
      ...processEnv,
      PORT: Number(processEnv.PORT),
    });
  });
});

describe("loadEnv", () => {
  it("reads a valid environment, with PORT as a number", () => {
    const source = buildSource();

    const env = loadEnv(source);

    expect(env).toStrictEqual({
      PORT: Number(source.PORT),
      MONGO_URL: source.MONGO_URL,
      JWT_SECRET: source.JWT_SECRET,
      MAILERSEND_API_KEY: source.MAILERSEND_API_KEY,
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
    ["PORT missing", { PORT: undefined }, "PORT"],
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

  it("names every invalid variable at once", () => {
    expect(() => loadEnv({})).toThrow(
      expect.objectContaining({
        code: SharedError.InputInvalid.code,
        data: {
          violations: [
            expect.objectContaining({ field: "PORT" }),
            expect.objectContaining({ field: "MONGO_URL" }),
            expect.objectContaining({ field: "JWT_SECRET" }),
            expect.objectContaining({ field: "MAILERSEND_API_KEY" }),
          ],
        },
      }),
    );
  });
});
