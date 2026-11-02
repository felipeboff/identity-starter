import type { ErrorReporter } from "@shared/application/ports/error-reporter";
import type { Logger } from "@shared/application/ports/logger";
import { ExpressAdapter } from "@shared/infrastructure/http/express-adapter";
import type { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import type { Dispatcher } from "@shared/presentation/dispatcher";
import { HttpErrorMapper } from "@shared/presentation/http/http-error-mapper";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { ApplicationModules, createHttpRoutes } from "./http-routes";

export type CreateServerOptions = Readonly<{
  modules: ApplicationModules;
  dispatcher: Dispatcher;
  logger: Logger;
  errors: ErrorReporter;
  logContext: AsyncLocalLogContext;
  readiness: Readonly<{ isReady(): Promise<boolean> }>;
  trustProxy: number;
  corsOrigins: readonly string[];
}>;

export const createServer = ({
  modules,
  dispatcher,
  logger,
  errors,
  logContext,
  readiness,
  trustProxy,
  corsOrigins,
}: CreateServerOptions): Express => {
  const adapter = new ExpressAdapter({
    dispatcher,
    errorMapper: new HttpErrorMapper({ logger, errors }),
    logger,
    logContext,
  });

  return express()
    .set("trust proxy", trustProxy)
    .use(adapter.requestContext())
    .use(helmet())
    .use(cors({ origin: [...corsOrigins], exposedHeaders: ["x-request-id"] }))
    .use(express.json())
    .get("/health", async (_req, res) => {
      const ready = await readiness.isReady();
      res
        .status(ready ? 200 : 503)
        .json({ status: ready ? "ok" : "unavailable" });
    })
    .use("/api", adapter.toRouter(createHttpRoutes(modules)))
    .use(adapter.notFound())
    .use(adapter.errorHandler());
};
