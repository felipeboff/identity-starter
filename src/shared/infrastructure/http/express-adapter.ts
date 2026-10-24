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

export type ExpressAdapterDeps = {
  dispatcher: Dispatcher;
  errorMapper: HttpErrorMapper;
};

export class ExpressAdapter {
  constructor(private readonly deps: ExpressAdapterDeps) {}

  /** One Express route per HttpRoute, in the given order. */
  toRouter(routes: readonly HttpRoute<unknown>[]): Router {
    const router = Router();
    for (const route of routes) {
      const method = route.method.toLowerCase() as
        "get" | "post" | "put" | "patch" | "delete";
      router[method](route.path, (req, res) => this.handle(route, req, res));
    }
    return router;
  }

  /** Registered after every route: answers an unknown method + path as `404` problem details. */
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

  /** Registered last: answers what fails before a route runs, such as a malformed JSON body. */
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

  private answerError(res: Response, error: unknown): void {
    const response = this.deps.errorMapper.map(error);
    res.status(response.status).set(response.headers).json(response.body);
  }

  /** What `express.json()` throws for a body it cannot parse. */
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

  /** Node gives some headers as arrays (set-cookie); Inbound takes one string per name. */
  private toMetadata(headers: Request["headers"]): Inbound["metadata"] {
    return Object.fromEntries(
      Object.entries(headers).map(([name, value]) => [
        name,
        Array.isArray(value) ? value.join(", ") : value,
      ]),
    );
  }
}
