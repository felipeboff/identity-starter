import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { HttpServerShutdown } from "@shared/infrastructure/http/http-server-shutdown";
import { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import { PinoLogger } from "@shared/infrastructure/logging/pino-logger";
import { MongoDatabase } from "@shared/infrastructure/mongo/mongo-database";
import { RedisConnection } from "@shared/infrastructure/redis/redis-connection";
import type { DestinationStream } from "pino";

import { type Env, NodeEnv, toIdentitySettings } from "./config";
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
    service: "resolve-hub",
    environment: env.NODE_ENV,
    level: env.LOG_LEVEL,
    format: env.NODE_ENV === NodeEnv.DEVELOP ? "pretty" : "json",
    destination: options.logDestination,
    context: logContext,
  });

  const database = new MongoDatabase({
    url: env.MONGO_URL,
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

  const identity = await createIdentityModule(toIdentitySettings(env), {
    connection: database.connection,
    redis: cache.client,
    logger,
    logContext,
  });

  const app = createServer({
    modules: {
      identity,
    },
    logger,
    logContext,
    readiness: database,
    trustProxy: env.TRUST_PROXY,
    corsOrigins: env.CORS_ORIGINS.map((origin) => origin.origin),
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
  let stopping: Promise<0 | 1> | undefined;

  const shutdown = async (): Promise<0 | 1> => {
    const outcome = await httpShutdown.run();
    await cache.close();
    await database.close();
    logger.info(SharedLogEvent.ServerStopped);
    return outcome === "drained" ? 0 : 1;
  };

  return { port, stop: () => (stopping ??= shutdown()) };
};
