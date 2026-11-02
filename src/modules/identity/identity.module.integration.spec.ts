import { faker } from "@faker-js/faker";
import { OutboxRelay } from "@shared/application/services/outbox-relay";
import { SharedError } from "@shared/domain/errors/shared.error";
import { MongoOutbox } from "@shared/infrastructure/mongo/mongo-outbox";
import type { OutboxDocument } from "@shared/infrastructure/mongo/outbox.schema";
import { RedisConnection } from "@shared/infrastructure/redis/redis-connection";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { OutboxConsumerAdapter } from "@shared/presentation/outbox/outbox-consumer-adapter";
import { SchemaParser } from "@shared/presentation/schema-parser";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeClock } from "@shared/testing/fake-clock";
import { FakeLogContext } from "@shared/testing/fake-log-context";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import { jwtVerify } from "jose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  type IdentityMailerSettings,
  type IdentitySettings,
  createIdentityModule,
} from "./identity.module";
import { GOOGLE_TOKEN_URL } from "./infrastructure/fetch-oauth-gateway";
import { IdentityLogEvent } from "./infrastructure/identity.log-event";
import { MAILERSEND_EMAIL_URL } from "./infrastructure/mailersend-identity-mailer";

import { RateLimitPolicy } from "@/identity/application/rate-limit.policy";
import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

const mongo = useMemoryMongo();
const redis = useMemoryRedis();
let cache: RedisConnection;

beforeAll(async () => {
  cache = new RedisConnection({ url: redis.url(), logger: new FakeLogger() });
  await cache.connect();
});

afterAll(async () => {
  await cache.close();
});

type SignUpOutput = { account: { id: string }; accessToken: string };

const buildOAuthClient = () => ({
  clientId: faker.string.alphanumeric(20),
  clientSecret: faker.string.alphanumeric(40),
  redirectUri: new URL(faker.internet.url()),
});

const buildSettings = (
  kind: IdentityMailerSettings["kind"] = "log",
): IdentitySettings => ({
  appName: faker.internet.domainWord(),
  jwtSecret: faker.string.alphanumeric(64),
  appUrl: new URL(faker.internet.url()),
  externalCallTimeoutMs: 1_000,
  mailer: {
    kind,
    apiKey: faker.string.alphanumeric(40),
    from: { email: faker.internet.email(), name: faker.company.name() },
  },
  google: buildOAuthClient(),
  github: buildOAuthClient(),
});

const create = async (settings = buildSettings()) => {
  const logger = new FakeLogger();
  const clock = new FakeClock(new Date());
  const outbox = new MongoOutbox({ connection: mongo.connection(), clock });
  await outbox.ready();
  const identity = await createIdentityModule(settings, {
    connection: mongo.connection(),
    redis: cache.client,
    logger,
    logContext: new FakeLogContext(),
    outbox,
    clock,
  });
  const dispatcher = new Dispatcher({ parser: new SchemaParser() });

  const call = (
    path: string,
    input: Record<string, unknown>,
    ip = faker.internet.ip(),
  ) => {
    const route = identity.publicRoutes.find(
      (candidate) => candidate.path === path,
    );
    if (!route) throw new Error(`No public route ${path}`);
    return dispatcher.dispatch(route, {
      input,
      metadata: { "user-agent": faker.internet.userAgent() },
      ip,
      actor: undefined,
    });
  };

  const signUp = async () => {
    const email = faker.internet.email().toLowerCase();
    const output = (await call("/auth/sign-up", {
      name: faker.person.fullName(),
      email,
      password: faker.internet.password(),
    })) as SignUpOutput;
    return { email, output };
  };

  const relay = new OutboxRelay({
    store: outbox,
    handlers: new OutboxConsumerAdapter({ dispatcher }).toHandlers(
      identity.outboxConsumers,
    ),
    clock,
    logger,
  });

  return { logger, call, signUp, settings, relay, clock };
};

const outboxEntries = () =>
  mongo.connection().collection<OutboxDocument>("outbox");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

const respondWith = (status: number, body?: unknown) => {
  const bodies: string[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    bodies.push(await (input as Request).text());
    return new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
    });
  });
  return { fetch, bodies };
};

describe("createIdentityModule", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores a sign-up in Mongo, with the password hashed by argon2id", async () => {
    const { signUp } = await create();

    const { email, output } = await signUp();

    const stored = mongo.connection();
    expect(await stored.collection("accounts").countDocuments({ email })).toBe(
      1,
    );
    expect(
      await stored.collection("credentials").findOne({ subject: email }),
    ).toMatchObject({
      passwordHash: expect.stringMatching(/^\$argon2id\$/) as unknown,
    });
    expect(output.account.id).toMatch(/^[0-9a-f]{24}$/);
  });

  it("rolls back every write of a use case that fails halfway", async () => {
    const { call } = await create();
    const stored = mongo.connection();
    const email = faker.internet.email().toLowerCase();
    await stored.db?.command({
      collMod: "memberships",
      validator: { $expr: { $eq: [1, 0] } },
    });

    try {
      await expect(
        call("/auth/sign-up", {
          name: faker.person.fullName(),
          email,
          password: faker.internet.password(),
        }),
      ).rejects.toThrow();

      expect(
        await stored
          .collection("credentials")
          .countDocuments({ subject: email }),
      ).toBe(0);
      expect(
        await stored.collection("accounts").countDocuments({ email }),
      ).toBe(0);
    } finally {
      await stored.db?.command({ collMod: "memberships", validator: {} });
    }
  });

  it("signs access tokens with the configured secret", async () => {
    const { signUp, settings } = await create();

    const { output } = await signUp();

    const { payload } = await jwtVerify(
      output.accessToken,
      new TextEncoder().encode(settings.jwtSecret),
    );
    expect(payload.sub).toBe(output.account.id);
  });

  it("logs the password reset link when the relay delivers the effect", async () => {
    const { signUp, call, logger, relay, clock } = await create(
      buildSettings("log"),
    );
    const { email } = await signUp();
    await outboxEntries().deleteMany({});
    const loggedBefore = logger.entries.length;

    await call("/auth/password-reset/request", { email });

    const [pending] = await outboxEntries().find().toArray();
    expect(pending).toMatchObject({
      type: "identity.password_reset_email",
      attempts: 0,
      processedAt: null,
      payload: { to: email },
    });
    expect(logger.entries.slice(loggedBefore)).toStrictEqual([]);
    const { token } = pending.payload as { token: string };

    await relay.relayNext();

    expect(logger.entries).toContainEqual(
      expect.objectContaining({
        event: IdentityLogEvent.EmailLogged.name,
        fields: expect.objectContaining({
          to: email,
          link: expect.stringContaining(token) as unknown,
        }) as unknown,
      }),
    );
    expect(await outboxEntries().findOne({ _id: pending._id })).toMatchObject({
      processedAt: clock.now(),
      payload: null,
      expiresAt: new Date(clock.now().getTime() + SEVEN_DAYS_MS),
    });
  });

  it("retries the MailerSend delivery after a failure", async () => {
    const answers = [503, 202];
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response("", { status: answers.shift() })),
    );
    vi.stubGlobal("fetch", fetch);
    const settings = buildSettings("mailersend");
    const { signUp, call, relay, clock } = await create(settings);
    const { email } = await signUp();
    await outboxEntries().deleteMany({});
    await call("/auth/password-reset/request", { email });
    const callsDuringRequest = fetch.mock.calls.length;
    const [pending] = await outboxEntries().find().toArray();

    await relay.relayNext();
    const afterFailure = await outboxEntries().findOne({ _id: pending._id });
    clock.advance(30 * 1_000);
    await relay.relayNext();

    expect(callsDuringRequest).toBe(0);
    expect(afterFailure).toMatchObject({
      attempts: 1,
      lastError: IdentityError.EmailDeliveryFailed.code,
      payload: pending.payload,
      processedAt: null,
    });
    expect(await outboxEntries().findOne({ _id: pending._id })).toMatchObject({
      processedAt: clock.now(),
      payload: null,
    });
    const request = fetch.mock.calls[1]?.[0] as Request;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(request.url).toBe(MAILERSEND_EMAIL_URL);
    expect(request.headers.get("authorization")).toBe(
      `Bearer ${settings.mailer.apiKey}`,
    );
  });

  it("exchanges OAuth codes with the configured Google client", async () => {
    const { fetch, bodies } = respondWith(400, { error: "invalid_grant" });
    vi.stubGlobal("fetch", fetch);
    const settings = buildSettings();
    const { call } = await create(settings);

    await expectAppError(
      call("/auth/oauth/:provider", {
        provider: AuthProvider.GOOGLE,
        code: faker.string.alphanumeric(20),
      }),
      IdentityError.OAuthCodeRejected,
      { provider: AuthProvider.GOOGLE },
    );

    const form = new URLSearchParams(bodies[0]);
    expect((fetch.mock.calls[0]?.[0] as Request).url).toBe(GOOGLE_TOKEN_URL);
    expect(form.get("client_id")).toBe(settings.google.clientId);
    expect(form.get("redirect_uri")).toBe(settings.google.redirectUri.href);
  });

  it("counts requests per IP in Redis", async () => {
    const { call } = await create();
    const ip = faker.internet.ip();
    const email = faker.internet.email().toLowerCase();
    for (
      let i = 0;
      i < RateLimitPolicy.PASSWORD_RESET_REQUEST_PER_IP.limit;
      i++
    ) {
      await call("/auth/password-reset/request", { email }, ip);
    }

    await expectAppError(
      call("/auth/password-reset/request", { email }, ip),
      SharedError.RateLimited,
    );
  });
});
