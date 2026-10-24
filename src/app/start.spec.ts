import type { Server } from "node:http";
import { Writable } from "node:stream";

import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "./config";

const buildEnv = (overrides: Partial<Env> = {}): Env => ({
  NODE_ENV: "test",
  // 0 lets the OS pick a free port.
  PORT: 0,
  TRUST_PROXY: 0,
  LOG_LEVEL: LogLevel.INFO,
  MONGO_URL: faker.internet.url(),
  JWT_SECRET: faker.string.alphanumeric(64),
  MAILERSEND_API_KEY: faker.string.alphanumeric(40),
  ...overrides,
});

// `start` imports the config, which reads process.env at import.
for (const [name, value] of Object.entries(buildEnv({ PORT: 3000 }))) {
  vi.stubEnv(name, String(value));
}
const { start } = await import("./start");

const createOutput = () => {
  const chunks: string[] = [];
  const logDestination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  return { logDestination, text: () => chunks.join("") };
};

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
        }),
    ),
  );
});

describe("start", () => {
  it("listens and serves the API", async () => {
    const { logDestination } = createOutput();

    const server = await start({ env: buildEnv(), logDestination });
    servers.push(server);

    const response = await request(server).post("/api/auth/sign-up").send({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    });
    expect(response.status).toBe(201);
  });

  it("logs the port it listens on as JSON outside develop", async () => {
    const { logDestination, text } = createOutput();

    const server = await start({ env: buildEnv(), logDestination });
    servers.push(server);

    const [line] = text().trim().split("\n");
    expect(JSON.parse(line ?? "")).toMatchObject({
      level: "info",
      event: SharedLogEvent.ServerStarted.name,
      port: (server.address() as { port: number }).port,
    });
  });

  it("logs in the pretty format in develop", async () => {
    const { logDestination, text } = createOutput();

    const server = await start({
      env: buildEnv({ NODE_ENV: "develop" }),
      logDestination,
    });
    servers.push(server);

    expect(text()).toContain(SharedLogEvent.ServerStarted.name);
    expect(() => JSON.parse(text()) as unknown).toThrow();
  });

  it("refuses to run the in-memory adapters in production", async () => {
    const { logDestination } = createOutput();

    await expectAppError(
      start({ env: buildEnv({ NODE_ENV: "prod" }), logDestination }),
      SharedError.InMemoryAdaptersInProduction,
    );
  });
});
