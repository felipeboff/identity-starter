import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import { PinoLogger } from "@shared/infrastructure/logging/pino-logger";
import { ObjectIdGenerator } from "@shared/infrastructure/mongo/object-id-generator";
import { SystemClock } from "@shared/infrastructure/time/system-clock";
import type { DestinationStream } from "pino";

import { type Env, NodeEnv } from "./config";
import { createServer } from "./create-server";

import {
  createIdentityModule,
  createInMemoryIdentityAdapters,
} from "@/identity/identity.module";

export type StartOptions = Readonly<{
  env: Env;
  logDestination: DestinationStream;
}>;

export const start = async ({
  env,
  logDestination,
}: StartOptions): Promise<Server> => {
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
    trustProxy: env.TRUST_PROXY,
  });

  const server = app.listen(env.PORT);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  logger.info(SharedLogEvent.ServerStarted, { port });
  return server;
};
