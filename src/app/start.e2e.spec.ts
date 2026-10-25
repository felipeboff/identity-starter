import { once } from "node:events";
import {
  createServer as createHttpServer,
  request as httpRequest,
} from "node:http";
import { createServer as createNetServer } from "node:net";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";

import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Env } from "./config";

const buildEnv = (overrides: Partial<Env> = {}): Env => ({
  NODE_ENV: "test",
  PORT: 0,
  TRUST_PROXY: 0,
  LOG_LEVEL: LogLevel.INFO,
  MONGO_URL: faker.internet.url(),
  JWT_SECRET: faker.string.alphanumeric(64),
  APP_URL: new URL(faker.internet.url()),
  MAILER: "log",
  MAIL_FROM_EMAIL: faker.internet.email(),
  MAIL_FROM_NAME: faker.company.name(),
  MAILERSEND_API_KEY: faker.string.alphanumeric(40),
  GITHUB_CLIENT_ID: faker.string.alphanumeric(20),
  GITHUB_CLIENT_SECRET: faker.string.hexadecimal({ length: 40, prefix: "" }),
  GITHUB_REDIRECT_URI: new URL(faker.internet.url()),
  GOOGLE_CLIENT_ID: `${faker.string.numeric(12)}-${faker.string.alphanumeric(32)}.apps.googleusercontent.com`,
  GOOGLE_CLIENT_SECRET: `GOCSPX-${faker.string.alphanumeric(28)}`,
  GOOGLE_REDIRECT_URI: new URL(faker.internet.url()),
  ...overrides,
});

for (const [name, value] of Object.entries(buildEnv({ PORT: 3000 }))) {
  vi.stubEnv(name, String(value));
}
const { start } = await import("./start");

type RunningApp = Awaited<ReturnType<typeof start>>;

const createOutput = () => {
  const chunks: string[] = [];
  const logDestination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  const text = () => chunks.join("");
  const events = () =>
    text()
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => (JSON.parse(line) as { event: string }).event);
  return { logDestination, text, events };
};

const freePort = async () => {
  const server = createNetServer().listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const connectionNamed = (database: string) =>
  mongoose.connections.find((connection) => connection.name === database);

const signUpBody = () =>
  JSON.stringify({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
  });

const signUpInFlight = async (port: number) => {
  const body = signUpBody();
  const half = Math.floor(body.length / 2);
  const req = httpRequest({
    host: "127.0.0.1",
    port,
    method: "POST",
    path: "/api/auth/sign-up",
    headers: {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    },
  });
  const response = new Promise<{ status?: number; error?: Error }>(
    (resolve) => {
      req.on("response", (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode }));
      });
      req.on("error", (error) => resolve({ error }));
    },
  );
  req.write(body.slice(0, half));
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { response, finish: () => req.end(body.slice(half)) };
};

describe("start", () => {
  let database: MongoMemoryReplSet;
  const running: RunningApp[] = [];

  beforeAll(async () => {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  });

  afterAll(async () => {
    await database.stop();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(running.splice(0).map((app) => app.stop()));
  });

  const databaseName = () =>
    faker.string.alpha({ length: 12, casing: "lower" });

  const startApp = async (
    overrides: Partial<Env> = {},
    name = databaseName(),
  ) => {
    const output = createOutput();
    const app = await start({
      env: buildEnv({ MONGO_URL: database.getUri(name), ...overrides }),
      logDestination: output.logDestination,
      timeouts: { shutdownMs: 2_000 },
    });
    running.push(app);
    return { app, output, url: `http://127.0.0.1:${app.port}`, name };
  };

  it("connects to the database before listening", async () => {
    const { output, url } = await startApp();

    const health = await request(url).get("/health");

    const events = output.events();
    expect(events.indexOf(SharedLogEvent.DatabaseConnected.name)).toBeLessThan(
      events.indexOf(SharedLogEvent.ServerStarted.name),
    );
    expect(events.indexOf(SharedLogEvent.DatabaseConnected.name)).not.toBe(-1);
    expect(health.status).toBe(200);
  });

  it("does not listen when the database is unavailable", async () => {
    const output = createOutput();
    const port = await freePort();

    await expectAppError(
      start({
        env: buildEnv({
          MONGO_URL: `mongodb://127.0.0.1:${port}/${databaseName()}`,
        }),
        logDestination: output.logDestination,
        timeouts: { databaseSelectionMs: 300 },
      }),
      SharedError.DatabaseUnavailable,
    );

    expect(output.events()).toContain(
      SharedLogEvent.DatabaseConnectionFailed.name,
    );
    expect(output.events()).not.toContain(SharedLogEvent.ServerStarted.name);
  });

  it("keeps the global mongoose connection unused", async () => {
    const { name } = await startApp();

    expect(mongoose.connection.readyState).toBe(0);
    expect(connectionNamed(name)?.readyState).toBe(1);
  });

  it("listens and serves the API", async () => {
    const { url } = await startApp();

    const response = await request(url)
      .post("/api/auth/sign-up")
      .set("content-type", "application/json")
      .send(signUpBody());

    expect(response.status).toBe(201);
  });

  it("stores what the API writes in Mongo", async () => {
    const { url, name } = await startApp();

    await request(url)
      .post("/api/auth/sign-up")
      .set("content-type", "application/json")
      .send(signUpBody());

    const stored = connectionNamed(name);
    expect(await stored?.collection("accounts").countDocuments()).toBe(1);
    expect(await stored?.collection("credentials").countDocuments()).toBe(1);
    expect(await stored?.collection("memberships").countDocuments()).toBe(1);
    expect(await stored?.collection("sessions").countDocuments()).toBe(1);
  });

  it("answers one 201 to simultaneous sign-ups with the same e-mail", async () => {
    const { url, name } = await startApp();
    const email = faker.internet.email().toLowerCase();

    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(url).post("/api/auth/sign-up").send({
          name: faker.person.fullName(),
          email,
          password: faker.internet.password(),
        }),
      ),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toStrictEqual([201, ...Array<number>(7).fill(400)]);
    for (const response of responses.filter(({ status }) => status === 400)) {
      expect([
        "identity.credential_email_taken",
        "identity.account_email_taken",
      ]).toContain((response.body as { code: string }).code);
    }
    const stored = connectionNamed(name);
    expect(await stored?.collection("accounts").countDocuments({ email })).toBe(
      1,
    );
    expect(
      await stored
        ?.collection("credentials")
        .countDocuments({ subject: email }),
    ).toBe(1);
    expect(await stored?.collection("memberships").countDocuments()).toBe(1);
  });

  it("does not listen when the database is not a replica set", async () => {
    const standalone = await MongoMemoryServer.create();
    const output = createOutput();

    try {
      await expectAppError(
        start({
          env: buildEnv({ MONGO_URL: standalone.getUri(databaseName()) }),
          logDestination: output.logDestination,
        }),
        SharedError.DatabaseNotReplicaSet,
      );
    } finally {
      await standalone.stop();
    }

    expect(output.events()).toContain(
      SharedLogEvent.DatabaseNotReplicaSet.name,
    );
    expect(output.events()).not.toContain(SharedLogEvent.ServerStarted.name);
  });

  it("logs the port it listens on as JSON outside develop", async () => {
    const { app, output } = await startApp();

    const started = output
      .text()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((line) => line.event === SharedLogEvent.ServerStarted.name);
    expect(started).toMatchObject({ level: "info", port: app.port });
  });

  it("logs in the pretty format in develop", async () => {
    const { output } = await startApp({ NODE_ENV: "develop" });

    expect(output.text()).toContain(SharedLogEvent.ServerStarted.name);
    expect(() => JSON.parse(output.text()) as unknown).toThrow();
  });

  it("dates what it stores with the system clock", async () => {
    const { url } = await startApp();
    const now = faker.date.recent();
    vi.useFakeTimers({ now, toFake: ["Date"] });

    const response = await request(url)
      .post("/api/auth/sign-up")
      .set("content-type", "application/json")
      .send(signUpBody());

    expect(response.body).toMatchObject({
      account: { createdAt: now.toISOString() },
    });
  });

  it("closes the database when the port is taken", async () => {
    const taken = createHttpServer().listen(0);
    await once(taken, "listening");
    const { port } = taken.address() as AddressInfo;
    const name = databaseName();

    await expect(
      start({
        env: buildEnv({ PORT: port, MONGO_URL: database.getUri(name) }),
        logDestination: createOutput().logDestination,
      }),
    ).rejects.toMatchObject({ code: "EADDRINUSE" });

    await new Promise((resolve) => taken.close(resolve));
    expect(connectionNamed(name)?.readyState).toBe(0);
  });

  describe("stop", () => {
    it("finishes in-flight requests before closing the database", async () => {
      const { app, output, name } = await startApp();
      const signUp = await signUpInFlight(app.port);

      const stopped = app.stop();
      signUp.finish();

      expect(await signUp.response).toStrictEqual({ status: 201 });
      expect(await stopped).toBe(0);
      expect(connectionNamed(name)?.readyState).toBe(0);
      const events = output.events();
      expect(events.at(-1)).toBe(SharedLogEvent.ServerStopped.name);
      expect(
        events.lastIndexOf(SharedLogEvent.RequestCompleted.name),
      ).toBeLessThan(events.indexOf(SharedLogEvent.ServerStopped.name));
    });

    it("refuses new connections once stopping", async () => {
      const { app } = await startApp();
      const signUp = await signUpInFlight(app.port);

      const stopped = app.stop();
      const fresh = await fetch(`http://127.0.0.1:${app.port}/health`).then(
        () => "accepted",
        (error: unknown) => error,
      );
      signUp.finish();
      await signUp.response;
      await stopped;

      expect(fresh).toMatchObject({ cause: { code: "ECONNREFUSED" } });
    });

    it("forces the shutdown after the timeout", async () => {
      const output = createOutput();
      const name = databaseName();
      const app = await start({
        env: buildEnv({ MONGO_URL: database.getUri(name) }),
        logDestination: output.logDestination,
        timeouts: { shutdownMs: 200 },
      });
      const signUp = await signUpInFlight(app.port);

      const code = await app.stop();

      expect(code).toBe(1);
      expect(await signUp.response).toMatchObject({
        error: expect.any(Error) as unknown,
      });
      expect(connectionNamed(name)?.readyState).toBe(0);
      expect(output.events()).toContain(SharedLogEvent.ServerStopped.name);
    });

    it("shuts down once when called twice", async () => {
      const { app, output } = await startApp();

      const [first, second] = await Promise.all([app.stop(), app.stop()]);

      expect([first, second]).toStrictEqual([0, 0]);
      expect(
        output
          .events()
          .filter((event) => event === SharedLogEvent.ServerStopped.name),
      ).toHaveLength(1);
    });
  });
});
