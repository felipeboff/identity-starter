import { randomUUID } from "node:crypto";

import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Logger } from "@shared/application/ports/logger";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { Inbound } from "@shared/presentation/handler";
import { HttpErrorMapper } from "@shared/presentation/http/http-error-mapper";
import { HttpRoute } from "@shared/presentation/http/http-route";
import {
  ErrorRequestHandler,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";

import type { AsyncLocalLogContext } from "../logging/async-local-log-context";

export type ExpressAdapterDeps = {
  dispatcher: Dispatcher;
  errorMapper: HttpErrorMapper;
  logger: Logger;
  logContext: AsyncLocalLogContext;
};

const REQUEST_ID = /^[\w.-]{1,128}$/;

export class ExpressAdapter {
  constructor(private readonly deps: ExpressAdapterDeps) {}

  requestContext(): RequestHandler {
    return (req, res, next) => {
      const startedAt = performance.now();
      const requestId = this.requestIdOf(req);
      res.setHeader("x-request-id", requestId);

      this.deps.logContext.run({ requestId, method: req.method }, () => {
        res.on(
          "finish",
          this.deps.logContext.bind(() => {
            this.deps.logger.info(SharedLogEvent.RequestCompleted, {
              status: res.statusCode,
              durationMs: Math.round(performance.now() - startedAt),
            });
          }),
        );
        next();
      });
    };
  }

  toRouter(routes: readonly HttpRoute<unknown>[]): Router {
    const router = Router();
    for (const route of routes) {
      const method = route.method.toLowerCase() as
        "get" | "post" | "put" | "patch" | "delete";
      router[method](route.path, (req, res) => this.handle(route, req, res));
    }
    return router;
  }

  notFound(): RequestHandler {
    return (req, res) => {
      this.answerError(
        res,
        new AppError(SharedError.RouteNotFound, {
          method: req.method,
          path: req.path,
        }),
      );
    };
  }

  errorHandler(): ErrorRequestHandler {
    // Express treats a handler as an error handler only when it declares four parameters.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (error: unknown, _req, res, _next) => {
      this.answerError(
        res,
        this.isMalformedBody(error)
          ? new AppError(SharedError.BodyMalformed)
          : error,
      );
    };
  }

  private async handle(
    route: HttpRoute<unknown>,
    req: Request,
    res: Response,
  ): Promise<void> {
    this.deps.logContext.add({ route: route.path });
    try {
      const output = await this.deps.dispatcher.dispatch(
        route,
        this.toInbound(req),
      );
      if (route.status === 204) {
        res.status(204).end();
        return;
      }
      res.status(route.status).json(output);
    } catch (error) {
      this.answerError(res, error);
    }
  }

  private requestIdOf(req: Request): string {
    const incoming = req.get("x-request-id");
    return incoming !== undefined && REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();
  }

  private answerError(res: Response, error: unknown): void {
    const response = this.deps.errorMapper.map(error);
    res.status(response.status).set(response.headers).json(response.body);
  }

  private isMalformedBody(error: unknown): boolean {
    return (
      error instanceof SyntaxError &&
      (error as SyntaxError & { type?: unknown }).type === "entity.parse.failed"
    );
  }

  private toInbound(req: Request): Inbound {
    return {
      input: { ...req.query, ...req.body, ...req.params },
      metadata: this.toMetadata(req.headers),
      ip: req.ip ?? "",
      actor: undefined,
    };
  }

  private toMetadata(headers: Request["headers"]): Inbound["metadata"] {
    return Object.fromEntries(
      Object.entries(headers).map(([name, value]) => [
        name,
        Array.isArray(value) ? value.join(", ") : value,
      ]),
    );
  }
}
