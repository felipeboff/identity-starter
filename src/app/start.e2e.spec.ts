import { once } from "node:events";
import {
  createServer as createHttpServer,
  request as httpRequest,
} from "node:http";
import { createServer as createNetServer } from "node:net";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";

import { faker } from "@faker-js/faker";
import * as Sentry from "@sentry/node";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { OutboxRelay } from "@shared/application/services/outbox-relay";
import { SharedError } from "@shared/domain/errors/shared.error";
import { BullOutboxQueue } from "@shared/infrastructure/jobs/bull-outbox-queue";
import { BullOutboxWorker } from "@shared/infrastructure/jobs/bull-outbox-worker";
import { BullScheduledJobs } from "@shared/infrastructure/jobs/bull-scheduled-jobs";
import { MongoDatabase } from "@shared/infrastructure/mongo/mongo-database";
import type { OutboxDocument } from "@shared/infrastructure/mongo/outbox.schema";
import { RedisConnection } from "@shared/infrastructure/redis/redis-connection";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeSentryIngest } from "@shared/testing/fake-sentry-ingest";
import { memoryMongoUri } from "@shared/testing/memory-mongo";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import { Queue } from "bullmq";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "./config";

const buildEnv = (overrides: Partial<Env> = {}): Env => ({
  APP_NAME: faker.internet.domainWord(),
  NODE_ENV: "test",
  PORT: 0,
  TRUST_PROXY: 0,
  LOG_LEVEL: LogLevel.INFO,
  MONGO_URL: faker.internet.url(),
  REDIS_URL: new URL(
    `redis://127.0.0.1:${faker.number.int({ min: 1_024, max: 65_535 })}`,
  ),
  CORS_ORIGINS: [new URL(faker.internet.url())],
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
  const redis = useMemoryRedis();
  const running: RunningApp[] = [];

  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(running.splice(0).map((app) => app.stop()));
    vi.restoreAllMocks();
  });

  const databaseName = () =>
    faker.string.alpha({ length: 12, casing: "lower" });

  const startApp = async (
    overrides: Partial<Env> = {},
    name = databaseName(),
  ) => {
    const output = createOutput();
    const app = await start({
      env: buildEnv({
        MONGO_URL: memoryMongoUri(name),
        REDIS_URL: new URL(redis.url()),
        ...overrides,
      }),
      logDestination: output.logDestination,
      timeouts: { shutdownMs: 2_000 },
    });
    running.push(app);
    return { app, output, url: `http://127.0.0.1:${app.port}`, name };
  };

  const unexpectedErrorRequest = (url: string) =>
    request(url)
      .post("/api/auth/sign-up")
      .set("content-type", "application/json")
      .send(JSON.stringify({ name: faker.string.alpha(200 * 1_024) }));

  const processHandlers = () => [
    process.listenerCount("uncaughtException"),
    process.listenerCount("unhandledRejection"),
  ];

  it("starts without Sentry when SENTRY_DSN is not set", async () => {
    const handlers = processHandlers();
    const client = Sentry.getClient();

    const { url } = await startApp();

    await request(url).get("/health").expect(200);
    expect(processHandlers()).toStrictEqual(handlers);
    expect(Sentry.getClient()).toBe(client);
  });

  it("delivers the pending Sentry events before stop resolves", async () => {
    const ingest = await FakeSentryIngest.start();
    const { app, url } = await startApp({ SENTRY_DSN: ingest.dsn });

    const response = await unexpectedErrorRequest(url);
    await app.stop();

    expect(response.status).toBe(500);
    expect(ingest.events()).toHaveLength(1);
    expect(ingest.events()[0]?.environment).toBe("test");
    await ingest.stop();
  });

  it("stops within the Sentry flush limit when Sentry does not answer", async () => {
    const ingest = await FakeSentryIngest.start({ answers: false });
    const { app, url } = await startApp({ SENTRY_DSN: ingest.dsn });
    await unexpectedErrorRequest(url).expect(500);

    const startedAt = performance.now();
    await app.stop();

    expect(performance.now() - startedAt).toBeLessThan(2_500);
    await ingest.stop();
  });

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

  it("connects to Redis before listening", async () => {
    const { output } = await startApp();

    const events = output.events();

    expect(events).toContain(SharedLogEvent.CacheConnected.name);
    expect(events.indexOf(SharedLogEvent.CacheConnected.name)).toBeLessThan(
      events.indexOf(SharedLogEvent.ServerStarted.name),
    );
  });

  it("does not listen when Redis is unavailable, and closes the database", async () => {
    const output = createOutput();
    const name = databaseName();

    await expectAppError(
      start({
        env: buildEnv({
          MONGO_URL: memoryMongoUri(name),
          REDIS_URL: new URL(`redis://127.0.0.1:${await freePort()}`),
        }),
        logDestination: output.logDestination,
      }),
      SharedError.CacheUnavailable,
    );

    expect(output.events()).toContain(
      SharedLogEvent.CacheConnectionFailed.name,
    );
    expect(output.events()).not.toContain(SharedLogEvent.ServerStarted.name);
    expect(connectionNamed(name)?.readyState).toBe(0);
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
    expect(started).toMatchObject({ level: LogLevel.INFO, port: app.port });
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
        env: buildEnv({
          PORT: port,
          MONGO_URL: memoryMongoUri(name),
          REDIS_URL: new URL(redis.url()),
        }),
        logDestination: createOutput().logDestination,
      }),
    ).rejects.toMatchObject({ code: "EADDRINUSE" });

    await new Promise((resolve) => taken.close(resolve));
    expect(connectionNamed(name)?.readyState).toBe(0);
  });

  const appName = () => faker.string.alpha({ length: 12, casing: "lower" });

  const queueOf = (name: string, prefix: string) => {
    const queue = new Queue(name, {
      connection: { url: redis.url() },
      prefix,
    });
    opened.push(queue);
    return queue;
  };
  const opened: Queue[] = [];

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((queue) => queue.close()));
  });

  it("delivers the e-mails recorded in the outbox while it runs", async () => {
    const prefix = appName();
    const { url, name, output } = await startApp({ APP_NAME: prefix });
    const outbox = () =>
      connectionNamed(name)!.collection<OutboxDocument>("outbox");
    const email = faker.internet.email().toLowerCase();

    await request(url)
      .post("/api/auth/sign-up")
      .send({
        name: faker.person.fullName(),
        email,
        password: faker.internet.password(),
      })
      .expect(201);
    await request(url)
      .post("/api/auth/password-reset/request")
      .send({ email })
      .expect(204);

    await vi.waitFor(
      async () => {
        expect(
          await outbox().countDocuments({ processedAt: { $ne: null } }),
        ).toBe(2);
      },
      { timeout: 5_000, interval: 100 },
    );
    expect(
      (await outbox().find().sort({ createdAt: 1 }).toArray()).map(
        ({ type, payload, failedAt }) => ({ type, payload, failedAt }),
      ),
    ).toStrictEqual([
      {
        type: "identity.email_verification_email",
        payload: null,
        failedAt: null,
      },
      { type: "identity.password_reset_email", payload: null, failedAt: null },
    ]);
    expect(
      output.events().filter((event) => event === "identity.email_logged"),
    ).toHaveLength(2);
    const counts = await queueOf("outbox", prefix).getJobCounts();
    expect(Object.values(counts).every((count) => count === 0)).toBe(true);
  });

  it("syncs the modules' scheduled jobs on start, removing the ones nobody declares", async () => {
    const prefix = appName();
    const scheduled = queueOf("scheduled", prefix);
    const stale = `${faker.lorem.word()}.${faker.string.alpha(10)}`;
    await scheduled.upsertJobScheduler(
      stale,
      { pattern: "0 9 * * *", tz: "America/Sao_Paulo" },
      { name: stale },
    );

    await startApp({ APP_NAME: prefix });

    expect(await scheduled.getJobSchedulers()).toStrictEqual([]);
  });

  it("closes the relay and the jobs before Redis and Mongo", async () => {
    const steps = {
      relay: vi.spyOn(OutboxRelay.prototype, "stop"),
      outboxWorker: vi.spyOn(BullOutboxWorker.prototype, "close"),
      scheduledJobs: vi.spyOn(BullScheduledJobs.prototype, "close"),
      outboxQueue: vi.spyOn(BullOutboxQueue.prototype, "close"),
      redis: vi.spyOn(RedisConnection.prototype, "close"),
      mongo: vi.spyOn(MongoDatabase.prototype, "close"),
    };
    const { app } = await startApp();

    await app.stop();

    const order = Object.entries(steps)
      .map(([step, spy]) => [step, spy.mock.invocationCallOrder[0]] as const)
      .sort(([, first], [, second]) => (first ?? 0) - (second ?? 0))
      .map(([step]) => step);
    expect(order).toStrictEqual([
      "relay",
      "outboxWorker",
      "scheduledJobs",
      "outboxQueue",
      "redis",
      "mongo",
    ]);
  });

  it("starts the outbox relay after listening and stops it before closing the database", async () => {
    const output = createOutput();
    let eventsAtRelayStart: string[] = [];
    vi.spyOn(OutboxRelay.prototype, "start").mockImplementation(() => {
      eventsAtRelayStart = output.events();
    });
    const close = vi.spyOn(MongoDatabase.prototype, "close");
    let closesWhenRelayStopped: number | undefined;
    vi.spyOn(OutboxRelay.prototype, "stop").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      closesWhenRelayStopped = close.mock.calls.length;
    });
    const app = await start({
      env: buildEnv({
        MONGO_URL: memoryMongoUri(databaseName()),
        REDIS_URL: new URL(redis.url()),
      }),
      logDestination: output.logDestination,
    });
    running.push(app);

    await app.stop();

    expect(eventsAtRelayStart).toContain(SharedLogEvent.ServerStarted.name);
    expect(closesWhenRelayStopped).toBe(0);
    expect(close).toHaveBeenCalledTimes(1);
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
        env: buildEnv({
          MONGO_URL: memoryMongoUri(name),
          REDIS_URL: new URL(redis.url()),
        }),
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
