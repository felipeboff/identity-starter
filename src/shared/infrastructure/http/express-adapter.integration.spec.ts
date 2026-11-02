import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { AppError, defineError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { Handler, Inbound } from "@shared/presentation/handler";
import { HttpErrorMapper } from "@shared/presentation/http/http-error-mapper";
import { HttpMethod, HttpRoute } from "@shared/presentation/http/http-route";
import { SchemaParser } from "@shared/presentation/schema-parser";
import { FakeErrorReporter } from "@shared/testing/fake-error-reporter";
import { FakeLogger } from "@shared/testing/fake-logger";
import express, { RequestHandler } from "express";
import request from "supertest";
import Type from "typebox";
import { describe, expect, it, vi } from "vitest";

import { AsyncLocalLogContext } from "../logging/async-local-log-context";

import { ExpressAdapter } from "./express-adapter";

const anyInput = Type.Record(Type.String(), Type.Unknown());

const anyOutput = Type.Unknown();

class EchoHandler extends Handler<{
  actor: unknown;
  input: typeof anyInput;
  output: typeof anyOutput;
}> {
  readonly name = `${faker.lorem.word()}.${faker.lorem.word()}`;
  readonly input = anyInput;
  readonly output = anyOutput;

  handle(inbound: Inbound<unknown>): Promise<unknown> {
    return Promise.resolve(inbound);
  }
}

class FailingHandler extends Handler<{
  deps: { error: Error };
  actor: unknown;
  output: typeof anyOutput;
}> {
  readonly name = `${faker.lorem.word()}.${faker.lorem.word()}`;

  handle(): Promise<unknown> {
    return Promise.reject(this.deps.error);
  }
}

const buildRoute = (
  overrides: Partial<HttpRoute<unknown>> = {},
): HttpRoute<unknown> => ({
  method: "POST",
  path: `/${faker.lorem.slug()}`,
  status: 200,
  failures: [],
  handler: new EchoHandler(),
  ...overrides,
});

class ContextHandler extends Handler<{
  deps: { logContext: AsyncLocalLogContext };
  actor: unknown;
  output: typeof anyOutput;
}> {
  readonly name = `${faker.lorem.word()}.${faker.lorem.word()}`;

  handle(): Promise<unknown> {
    return Promise.resolve(this.deps.logContext.get());
  }
}

const createApp = (
  routes: readonly HttpRoute<unknown>[],
  before: RequestHandler[] = [],
  logContext = new AsyncLocalLogContext(),
) => {
  const logger = new FakeLogger();
  const adapter = new ExpressAdapter({
    dispatcher: new Dispatcher({ parser: new SchemaParser() }),
    errorMapper: new HttpErrorMapper({
      appName: faker.internet.domainWord(),
      logger,
      errors: new FakeErrorReporter(),
    }),
    logger,
    logContext,
  });
  const app = express()
    .use(adapter.requestContext())
    .use(express.json())
    .use(...before, adapter.toRouter(routes))
    .use(adapter.notFound())
    .use(adapter.errorHandler());
  return { app, logger };
};

const errorsOf = (logger: FakeLogger) =>
  logger.entries.filter((entry) => entry.level === LogLevel.ERROR);

describe("ExpressAdapter", () => {
  it.each<HttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"])(
    "registers a %s route at its path",
    async (method) => {
      const route = buildRoute({ method });
      const { app } = createApp([route]);

      const response = await request(app)[
        method.toLowerCase() as Lowercase<HttpMethod>
      ](route.path);

      expect(response.status).toBe(200);
    },
  );

  it("answers the route's status with the handler output as JSON", async () => {
    const status = faker.helpers.arrayElement([200, 201, 202] as const);
    const route = buildRoute({ status });
    const { app } = createApp([route]);

    const response = await request(app).post(route.path);

    expect(response.status).toBe(status);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
  });

  it("answers 204 with no body", async () => {
    const route = buildRoute({ status: 204 });
    const { app } = createApp([route]);

    const response = await request(app).post(route.path).send({});

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("merges query, body and params into the input, params last", async () => {
    const resource = faker.lorem.slug();
    const route = buildRoute({ path: `/${resource}/:thingId` });
    const { app } = createApp([route]);
    const thingId = faker.database.mongodbObjectId();
    const page = String(faker.number.int({ min: 1, max: 9 }));
    const name = faker.person.fullName();

    const response = await request(app)
      .post(`/${resource}/${thingId}`)
      .query({ page })
      .send({ name, thingId: faker.database.mongodbObjectId() });

    expect((response.body as Inbound<unknown>).input).toStrictEqual({
      page,
      name,
      thingId,
    });
  });

  it("passes the headers as metadata, joining repeated ones", async () => {
    const route = buildRoute();
    const cookies = [faker.lorem.word(), faker.lorem.word()];
    const repeatHeader: RequestHandler = (req, _res, next) => {
      req.headers["set-cookie"] = cookies;
      next();
    };
    const { app } = createApp([route], [repeatHeader]);
    const userAgent = faker.internet.userAgent();

    const response = await request(app)
      .post(route.path)
      .set("user-agent", userAgent);

    expect((response.body as Inbound<unknown>).metadata).toMatchObject({
      "user-agent": userAgent,
      "set-cookie": cookies.join(", "),
    });
  });

  it("passes the ip Express resolves, with no actor yet", async () => {
    const route = buildRoute();
    const { app } = createApp([route]);

    const response = await request(app).post(route.path);

    const inbound = response.body as Inbound<unknown>;
    expect(inbound.ip).toMatch(/127\.0\.0\.1|::1/);
    expect(inbound).not.toHaveProperty("actor");
  });

  it("passes an empty ip when Express cannot resolve one", async () => {
    const route = buildRoute();
    const hideIp: RequestHandler = (req, _res, next) => {
      Object.defineProperty(req, "ip", { value: undefined });
      next();
    };
    const { app } = createApp([route], [hideIp]);

    const response = await request(app).post(route.path);

    expect((response.body as Inbound<unknown>).ip).toBe("");
  });

  it("answers an AppError with its problem details", async () => {
    const NotFound = defineError(
      `${faker.lorem.word()}.${faker.lorem.word()}`,
      "not_found",
    );
    const route = buildRoute({
      handler: new FailingHandler({ error: new AppError(NotFound) }),
    });
    const { app, logger } = createApp([route]);

    const response = await request(app).post(route.path);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json/,
    );
    expect(response.body).toMatchObject({ status: 404, code: NotFound.code });
    expect(errorsOf(logger)).toStrictEqual([]);
  });

  it("answers 500 and logs an unexpected error", async () => {
    const error = new Error(faker.lorem.sentence());
    const route = buildRoute({ handler: new FailingHandler({ error }) });
    const { app, logger } = createApp([route]);

    const response = await request(app).post(route.path);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ code: "shared.internal" });
    expect(errorsOf(logger)).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.UnexpectedError.name,
        fields: { error },
      },
    ]);
  });

  it("answers an unknown route with 404 problem details", async () => {
    const { app } = createApp([buildRoute()]);
    const path = `/${faker.lorem.slug()}`;

    const response = await request(app).get(path);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(
      /^application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      code: SharedError.RouteNotFound.code,
      data: { method: "GET", path },
    });
  });

  it("answers a malformed JSON body with 400 problem details", async () => {
    const route = buildRoute();
    const { app, logger } = createApp([route]);

    const response = await request(app)
      .post(route.path)
      .set("content-type", "application/json")
      .send(`{${faker.lorem.word()}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: SharedError.BodyMalformed.code,
    });
    expect(errorsOf(logger)).toStrictEqual([]);
  });

  it("answers 500 and logs an unexpected error raised before the route", async () => {
    const route = buildRoute();
    const error = new Error(faker.lorem.sentence());
    const failBefore: RequestHandler = (_req, _res, next) => {
      next(error);
    };
    const { app, logger } = createApp([route], [failBefore]);

    const response = await request(app).post(route.path);

    expect(response.status).toBe(500);
    expect(errorsOf(logger)).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.UnexpectedError.name,
        fields: { error },
      },
    ]);
  });

  describe("request context", () => {
    const UUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    it("answers a new request id when the client sends none", async () => {
      const route = buildRoute();
      const { app } = createApp([route]);

      const response = await request(app).post(route.path);

      expect(response.headers["x-request-id"]).toMatch(UUID);
    });

    it("keeps the client's request id when it is safe", async () => {
      const route = buildRoute();
      const { app } = createApp([route]);
      const requestId = faker.string.alphanumeric(24);

      const response = await request(app)
        .post(route.path)
        .set("x-request-id", requestId);

      expect(response.headers["x-request-id"]).toBe(requestId);
    });

    it("replaces a request id that could forge a log line", async () => {
      const route = buildRoute();
      const { app } = createApp([route]);

      const response = await request(app)
        .post(route.path)
        .set("x-request-id", `${faker.lorem.word()} ${faker.lorem.word()}`);

      expect(response.headers["x-request-id"]).toMatch(UUID);
    });

    it("runs the handler with the request id, method, route template and operation", async () => {
      const logContext = new AsyncLocalLogContext();
      const resource = faker.lorem.slug();
      const route = buildRoute({
        path: `/${resource}/:thingId`,
        handler: new ContextHandler({ logContext }),
      });
      const { app } = createApp([route], [], logContext);

      const response = await request(app).post(
        `/${resource}/${faker.database.mongodbObjectId()}`,
      );

      expect(response.body).toStrictEqual({
        requestId: response.headers["x-request-id"],
        method: "POST",
        route: route.path,
        operation: route.handler.name,
      });
    });

    it("logs the completed request with its status and duration, in its context", async () => {
      const logContext = new AsyncLocalLogContext();
      const route = buildRoute({ status: 201 });
      const { app, logger } = createApp([route], [], logContext);
      const contexts: unknown[] = [];
      const info = vi.spyOn(logger, "info").mockImplementation(() => {
        contexts.push(logContext.get());
      });

      const response = await request(app).post(route.path);

      expect(info).toHaveBeenCalledExactlyOnceWith(
        SharedLogEvent.RequestCompleted,
        { status: 201, durationMs: expect.any(Number) as unknown },
      );
      expect(contexts).toStrictEqual([
        {
          requestId: response.headers["x-request-id"],
          method: "POST",
          route: route.path,
          operation: route.handler.name,
        },
      ]);
    });
  });
});
