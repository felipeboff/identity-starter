import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { HttpServerShutdown } from "@shared/infrastructure/http/http-server-shutdown";
import { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import { PinoLogger } from "@shared/infrastructure/logging/pino-logger";
import { MongoDatabase } from "@shared/infrastructure/mongo/mongo-database";
import { ObjectIdGenerator } from "@shared/infrastructure/mongo/object-id-generator";
import { SystemClock } from "@shared/infrastructure/time/system-clock";
import type { DestinationStream } from "pino";

import { type Env, NodeEnv } from "./config";
import { createServer } from "./create-server";

import {
  createIdentityModule,
  createInMemoryIdentityAdapters,
} from "@/identity/identity.module";

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

export const start = async ({
  env,
  logDestination,
  timeouts = {},
}: StartOptions): Promise<RunningApp> => {
  const autoIndex = env.NODE_ENV !== NodeEnv.PROD;
  if (env.NODE_ENV === NodeEnv.PROD) {
    throw new AppError(SharedError.InMemoryAdaptersInProduction);
  }

  const logContext = new AsyncLocalLogContext();
  const logger = PinoLogger.create({
    service: "resolve-hub",
    environment: env.NODE_ENV,
    level: env.LOG_LEVEL,
    format: env.NODE_ENV === NodeEnv.DEVELOP ? "pretty" : "json",
    destination: logDestination,
    context: logContext,
  });

  const database = new MongoDatabase({
    url: env.MONGO_URL,
    logger,
    autoIndex,
    serverSelectionTimeoutMS: timeouts.databaseSelectionMs,
    heartbeatFrequencyMS: timeouts.databaseHeartbeatMs,
    pingTimeoutMS: timeouts.databasePingMs,
  });
  await database.connect();

  const app = createServer({
    modules: {
      identity: createIdentityModule({
        ...createInMemoryIdentityAdapters(),
        clock: new SystemClock(),
        ids: new ObjectIdGenerator(),
        logContext,
      }),
    },
    logger,
    logContext,
    readiness: database,
    trustProxy: env.TRUST_PROXY,
  });

  const server = app.listen(env.PORT);
  try {
    await once(server, "listening");
  } catch (error) {
    await database.close();
    throw error;
  }
  const httpShutdown = new HttpServerShutdown(server, timeouts.shutdownMs);
  const { port } = server.address() as AddressInfo;
  logger.info(SharedLogEvent.ServerStarted, { port });

  let stopping: Promise<0 | 1> | undefined;
  const shutdown = async (): Promise<0 | 1> => {
    const outcome = await httpShutdown.run();
    await database.close();
    logger.info(SharedLogEvent.ServerStopped);
    return outcome === "drained" ? 0 : 1;
  };

  return { port, stop: () => (stopping ??= shutdown()) };
};
