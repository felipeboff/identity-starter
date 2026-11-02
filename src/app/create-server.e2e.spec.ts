import { Writable } from "node:stream";

import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel, type Logger } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import { PinoLogger } from "@shared/infrastructure/logging/pino-logger";
import { MongoOutbox } from "@shared/infrastructure/mongo/mongo-outbox";
import { RedisConnection } from "@shared/infrastructure/redis/redis-connection";
import { SystemClock } from "@shared/infrastructure/time/system-clock";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { SchemaParser } from "@shared/presentation/schema-parser";
import { FakeErrorReporter } from "@shared/testing/fake-error-reporter";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createServer } from "./create-server";

import {
  type IdentitySettings,
  createIdentityModule,
} from "@/identity/identity.module";

const mongo = useMemoryMongo();
const redis = useMemoryRedis();
const clock = new SystemClock();
const dispatcher = new Dispatcher({ parser: new SchemaParser() });
let cache: RedisConnection;

beforeAll(async () => {
  cache = new RedisConnection({ url: redis.url(), logger: new FakeLogger() });
  await cache.connect();
});

afterAll(async () => {
  await cache.close();
});

const ALLOWED_ORIGIN = new URL(faker.internet.url()).origin;

const buildOAuthClient = () => ({
  clientId: faker.string.alphanumeric(20),
  clientSecret: faker.string.alphanumeric(40),
  redirectUri: new URL(faker.internet.url()),
});

const identitySettings: IdentitySettings = {
  appName: faker.internet.domainWord(),
  jwtSecret: faker.string.alphanumeric(64),
  appUrl: new URL(faker.internet.url()),
  externalCallTimeoutMs: 1_000,
  mailer: {
    kind: "log",
    apiKey: faker.string.alphanumeric(40),
    from: { email: faker.internet.email(), name: faker.company.name() },
  },
  google: buildOAuthClient(),
  github: buildOAuthClient(),
};

const createApp = async (
  trustProxy = 0,
  logContext = new AsyncLocalLogContext(),
  logger: Logger = new FakeLogger(),
  ready = true,
  corsOrigins = [ALLOWED_ORIGIN],
  errors = new FakeErrorReporter(),
) =>
  createServer({
    appName: identitySettings.appName,
    dispatcher,
    modules: {
      identity: await createIdentityModule(identitySettings, {
        connection: mongo.connection(),
        redis: cache.client,
        logger: new FakeLogger(),
        logContext,
        outbox: new MongoOutbox({ connection: mongo.connection(), clock }),
        clock,
      }),
    },
    logger,
    errors,
    logContext,
    readiness: { isReady: () => Promise.resolve(ready) },
    trustProxy,
    corsOrigins,
  });

type App = Awaited<ReturnType<typeof createApp>>;

const signUp = (app: App) =>
  request(app).post("/api/auth/sign-up").send({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
  });

const sessionIpOf = async (app: App, accessToken: string) => {
  const response = await request(app)
    .get("/api/me/sessions")
    .set("authorization", `Bearer ${accessToken}`);
  const { sessions } = response.body as { sessions: { ipAddress: string }[] };
  return sessions[0]?.ipAddress;
};

describe("createServer", () => {
  it("reports an unexpected error once and answers 500", async () => {
    const errors = new FakeErrorReporter();
    const failure = new TypeError(faker.lorem.sentence());
    const logContext = new AsyncLocalLogContext();
    const app = createServer({
      appName: identitySettings.appName,
      dispatcher,
      modules: {
        identity: await createIdentityModule(identitySettings, {
          connection: mongo.connection(),
          redis: cache.client,
          logger: new FakeLogger(),
          logContext,
          outbox: new MongoOutbox({ connection: mongo.connection(), clock }),
          clock,
        }),
      },
      logger: new FakeLogger(),
      errors,
      logContext,
      readiness: { isReady: () => Promise.reject(failure) },
      trustProxy: 0,
      corsOrigins: [ALLOWED_ORIGIN],
    });

    const response = await request(app).get("/health");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ code: "shared.internal" });
    expect(errors.reported).toStrictEqual([failure]);
  });

  it("serves the module routes under /api", async () => {
    const app = await createApp();

    const response = await signUp(app);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      accessToken: expect.any(String) as unknown,
      refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
    });
  });

  it("refreshes the session with the refresh token it issued", async () => {
    const app = await createApp();
    const signedUp = await signUp(app);
    const { refreshToken } = signedUp.body as { refreshToken: string };

    const response = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect((response.body as { refreshToken: string }).refreshToken).not.toBe(
      refreshToken,
    );
  });

  it("answers with security and CORS headers", async () => {
    const app = await createApp();

    const response = await signUp(app).set("origin", ALLOWED_ORIGIN);

    expect(response.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-expose-headers": "x-request-id",
    });
    expect(response.headers).not.toHaveProperty("x-powered-by");
  });

  it("stores the forwarded client IP when it trusts the proxy", async () => {
    const app = await createApp(1);
    const clientIp = faker.internet.ipv4();

    const response = await signUp(app).set("x-forwarded-for", clientIp);

    const { accessToken } = response.body as { accessToken: string };
    expect(await sessionIpOf(app, accessToken)).toBe(clientIp);
  });

  it("ignores x-forwarded-for when it trusts no proxy", async () => {
    const app = await createApp(0);
    const clientIp = faker.internet.ipv4();

    const response = await signUp(app).set("x-forwarded-for", clientIp);

    const { accessToken } = response.body as { accessToken: string };
    expect(await sessionIpOf(app, accessToken)).not.toBe(clientIp);
  });

  it("answers a path outside the API with 404 problem details", async () => {
    const app = await createApp();

    const response = await request(app).get(`/${faker.lorem.slug()}`);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: SharedError.RouteNotFound.code,
    });
  });

  it("answers a malformed JSON body with 400 problem details", async () => {
    const app = await createApp();

    const response = await request(app)
      .post("/api/auth/sign-up")
      .set("content-type", "application/json")
      .send(`{${faker.lorem.word()}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: SharedError.BodyMalformed.code,
    });
  });

  it("logs each request with its id, route and the signed-in account", async () => {
    const chunks: string[] = [];
    const logContext = new AsyncLocalLogContext();
    const logger = PinoLogger.create({
      service: faker.lorem.slug(),
      environment: faker.lorem.word(),
      level: LogLevel.INFO,
      format: "json",
      destination: new Writable({
        write(chunk: Buffer, _encoding, done) {
          chunks.push(chunk.toString());
          done();
        },
      }),
      context: logContext,
    });
    const app = await createApp(0, logContext, logger);
    const signedUp = await signUp(app);
    const { account, accessToken } = signedUp.body as {
      account: { id: string };
      accessToken: string;
    };

    const response = await request(app)
      .get("/api/me")
      .set("authorization", `Bearer ${accessToken}`);

    const completed = chunks
      .join("")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line.event === SharedLogEvent.RequestCompleted.name);
    expect(completed.at(-1)).toMatchObject({
      requestId: response.headers["x-request-id"],
      method: "GET",
      route: "/me",
      accountId: account.id,
      status: 200,
    });
  });

  describe("GET /health", () => {
    it("answers ready when the database answers", async () => {
      const app = await createApp();

      const health = await request(app).get("/health");
      const insideApi = await request(app).get("/api/health");

      expect(health.status).toBe(200);
      expect(health.body).toStrictEqual({ status: "ok" });
      expect(insideApi.status).toBe(404);
    });

    it("answers unavailable when the database does not", async () => {
      const app = await createApp(0, undefined, undefined, false);

      const response = await request(app).get("/health");

      expect(response.status).toBe(503);
      expect(response.body).toStrictEqual({ status: "unavailable" });
    });
  });

  it("allows CORS only for the configured origins", async () => {
    const app = await createApp();
    const unknown = `${ALLOWED_ORIGIN}.${faker.internet.domainWord()}`;

    const allowed = await request(app)
      .get("/health")
      .set("origin", ALLOWED_ORIGIN);
    const refused = await request(app).get("/health").set("origin", unknown);

    expect(allowed.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(refused.headers["access-control-allow-origin"]).toBeUndefined();
    expect(refused.status).toBe(200);
  });
});
