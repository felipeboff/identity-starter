import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { OutboxEffectRunner } from "@shared/application/services/outbox-effect-runner";
import { OutboxRelay } from "@shared/application/services/outbox-relay";
import { DisabledErrorReporter } from "@shared/infrastructure/errors/disabled-error-reporter";
import { SentryErrorReporter } from "@shared/infrastructure/errors/sentry-error-reporter";
import { HttpServerShutdown } from "@shared/infrastructure/http/http-server-shutdown";
import { BullOutboxQueue } from "@shared/infrastructure/jobs/bull-outbox-queue";
import { BullOutboxWorker } from "@shared/infrastructure/jobs/bull-outbox-worker";
import { BullScheduledJobs } from "@shared/infrastructure/jobs/bull-scheduled-jobs";
import { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import { PinoLogger } from "@shared/infrastructure/logging/pino-logger";
import { MongoDatabase } from "@shared/infrastructure/mongo/mongo-database";
import { MongoOutbox } from "@shared/infrastructure/mongo/mongo-outbox";
import { RedisConnection } from "@shared/infrastructure/redis/redis-connection";
import { SystemClock } from "@shared/infrastructure/time/system-clock";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { OutboxConsumerAdapter } from "@shared/presentation/outbox/outbox-consumer-adapter";
import { SchemaParser } from "@shared/presentation/schema-parser";
import type { DestinationStream } from "pino";

import {
  type Env,
  NodeEnv,
  toDocsCredentials,
  toIdentitySettings,
} from "./config";
import { createServer } from "./create-server";

import { createIdentityModule } from "@/identity/identity.module";

export type StartTimeouts = Readonly<{
  databaseSelectionMs?: number;
  databaseHeartbeatMs?: number;
  databasePingMs?: number;
  shutdownMs?: number;
}>;

export type StartOptions = Readonly<{
  env: Env;
  logDestination: DestinationStream;
  timeouts?: StartTimeouts;
}>;

export type RunningApp = Readonly<{
  port: number;
  stop(): Promise<0 | 1>;
}>;

export const start = async (options: StartOptions): Promise<RunningApp> => {
  const env = options.env;
  const timeouts = options.timeouts ?? {};
  const logContext = new AsyncLocalLogContext();

  const logger = PinoLogger.create({
    service: env.APP_NAME,
    environment: env.NODE_ENV,
    level: env.LOG_LEVEL,
    format: env.NODE_ENV === NodeEnv.DEVELOP ? "pretty" : "json",
    destination: options.logDestination,
    context: logContext,
  });

  const sentry =
    env.SENTRY_DSN === undefined
      ? undefined
      : SentryErrorReporter.create({
          dsn: env.SENTRY_DSN,
          environment: env.NODE_ENV,
          context: logContext,
        });

  const database = new MongoDatabase({
    url: env.MONGO_URL,
    appName: env.APP_NAME,
    logger,
    serverSelectionTimeoutMS: timeouts.databaseSelectionMs,
    heartbeatFrequencyMS: timeouts.databaseHeartbeatMs,
    pingTimeoutMS: timeouts.databasePingMs,
  });

  await database.connect();

  const cache = new RedisConnection({ url: env.REDIS_URL.href, logger });
  try {
    await cache.connect();
  } catch (error) {
    await database.close();
    throw error;
  }

  const clock = new SystemClock();
  const outbox = new MongoOutbox({ connection: database.connection, clock });
  await outbox.ready();

  const identity = await createIdentityModule(toIdentitySettings(env), {
    connection: database.connection,
    redis: cache.client,
    logger,
    logContext,
    outbox,
    clock,
  });

  const dispatcher = new Dispatcher({ parser: new SchemaParser() });
  const app = createServer({
    appName: env.APP_NAME,
    modules: {
      identity,
    },
    dispatcher,
    logger,
    errors: sentry ?? new DisabledErrorReporter(),
    logContext,
    readiness: database,
    trustProxy: env.TRUST_PROXY,
    corsOrigins: env.CORS_ORIGINS.map((origin) => origin.origin),
    docs: toDocsCredentials(env),
  });

  const server = app.listen(env.PORT);
  try {
    await once(server, "listening");
  } catch (error) {
    await cache.close();
    await database.close();
    throw error;
  }

  const httpShutdown = new HttpServerShutdown(server, timeouts.shutdownMs);
  const { port } = server.address() as AddressInfo;
  logger.info(SharedLogEvent.ServerStarted, { port });

  const jobs = {
    redis: cache.client,
    url: env.REDIS_URL.href,
    prefix: env.APP_NAME,
  };
  const outboxQueue = new BullOutboxQueue(jobs);
  const outboxWorker = new BullOutboxWorker({
    settings: jobs,
    runner: new OutboxEffectRunner({
      store: outbox,
      handlers: new OutboxConsumerAdapter({ dispatcher }).toHandlers(
        identity.outboxConsumers,
      ),
      clock,
      logger,
    }),
  });
  const scheduledJobs = new BullScheduledJobs({
    settings: jobs,
    jobs: identity.scheduledJobs,
    dispatcher,
    logger,
  });
  await scheduledJobs.sync();

  const relay = new OutboxRelay({
    store: outbox,
    queue: outboxQueue,
    clock,
    logger,
  });
  relay.start();
  let stopping: Promise<0 | 1> | undefined;

  const shutdown = async (): Promise<0 | 1> => {
    const outcome = await httpShutdown.run();
    await relay.stop();
    await outboxWorker.close();
    await scheduledJobs.close();
    await outboxQueue.close();
    await cache.close();
    await database.close();
    await sentry?.close();
    logger.info(SharedLogEvent.ServerStopped);
    return outcome === "drained" ? 0 : 1;
  };

  return { port, stop: () => (stopping ??= shutdown()) };
};
