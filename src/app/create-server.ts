import type { ErrorReporter } from "@shared/application/ports/error-reporter";
import type { Logger } from "@shared/application/ports/logger";
import {
  BasicAuth,
  type BasicAuthCredentials,
} from "@shared/infrastructure/http/basic-auth";
import { ExpressAdapter } from "@shared/infrastructure/http/express-adapter";
import type { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import type { Dispatcher } from "@shared/presentation/dispatcher";
import { HttpErrorMapper } from "@shared/presentation/http/http-error-mapper";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import packageJson from "../../package.json" with { type: "json" };

import {
  ApplicationModules,
  createHttpRoutes,
  createOpenApiDocument,
} from "./http-routes";

const API_PATH = "/api";

export type CreateServerOptions = Readonly<{
  appName: string;
  modules: ApplicationModules;
  dispatcher: Dispatcher;
  logger: Logger;
  errors: ErrorReporter;
  logContext: AsyncLocalLogContext;
  readiness: Readonly<{ isReady(): Promise<boolean> }>;
  trustProxy: number;
  corsOrigins: readonly string[];
  docs: BasicAuthCredentials | null;
}>;

export const createServer = ({
  appName,
  modules,
  dispatcher,
  logger,
  errors,
  logContext,
  readiness,
  trustProxy,
  corsOrigins,
  docs,
}: CreateServerOptions): Express => {
  const adapter = new ExpressAdapter({
    dispatcher,
    errorMapper: new HttpErrorMapper({ appName, logger, errors }),
    logger,
    logContext,
  });

  const app = express()
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
    });

  if (docs !== null) {
    const guard = new BasicAuth({
      realm: `${appName} docs`,
      credentials: docs,
    }).guard();
    const openApi = createOpenApiDocument(modules, {
      title: appName,
      version: packageJson.version,
      basePath: API_PATH,
    });
    app
      .get("/openapi.json", guard, (_req, res) => {
        res.json(openApi);
      })
      .use(
        "/docs",
        guard,
        swaggerUi.serve,
        swaggerUi.setup(openApi, { customSiteTitle: `${appName} API` }),
      );
  }

  return app
    .use(API_PATH, adapter.toRouter(createHttpRoutes(modules)))
    .use(adapter.notFound())
    .use(adapter.errorHandler());
};
