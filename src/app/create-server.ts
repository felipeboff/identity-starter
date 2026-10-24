import type { Logger } from "@shared/application/ports/logger";
import { ExpressAdapter } from "@shared/infrastructure/http/express-adapter";
import type { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { HttpErrorMapper } from "@shared/presentation/http/http-error-mapper";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { ApplicationModules, createHttpRoutes } from "./http-routes";

export type CreateServerOptions = Readonly<{
  modules: ApplicationModules;
  logger: Logger;
  logContext: AsyncLocalLogContext;
  /** Proxies in front of the app to trust for `req.ip`; 0 trusts none. */
  trustProxy: number;
}>;

/** The Express app: security headers, CORS, JSON bodies, the API under `/api`, problem details for every failure. */
export const createServer = ({
  modules,
  logger,
  logContext,
  trustProxy,
}: CreateServerOptions): Express => {
  const adapter = new ExpressAdapter({
    dispatcher: new Dispatcher(),
    errorMapper: new HttpErrorMapper({ logger }),
    logger,
    logContext,
  });

  return express()
    .set("trust proxy", trustProxy)
    .use(adapter.requestContext())
    .use(helmet())
    .use(cors({ exposedHeaders: ["x-request-id"] }))
    .use(express.json())
    .use("/api", adapter.toRouter(createHttpRoutes(modules)))
    .use(adapter.notFound())
    .use(adapter.errorHandler());
};
