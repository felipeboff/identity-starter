import { appendFileSync } from "node:fs";

import { faker } from "@faker-js/faker";
import { ExpressAdapter } from "@shared/infrastructure/http/express-adapter";
import { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { HttpErrorMapper } from "@shared/presentation/http/http-error-mapper";
import { HttpResponse } from "@shared/presentation/http/http-response";
import { HttpMethod } from "@shared/presentation/http/http-route";
import { HttpRouter } from "@shared/presentation/http/http-router";
import { SchemaParser } from "@shared/presentation/schema-parser";
import { FakeLogger } from "@shared/testing/fake-logger";
import { RouteStatusMatrix } from "@shared/testing/route-status-matrix";
import express from "express";
import request from "supertest";
import { inject } from "vitest";

import {
  SeedAccountOptions,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "@/identity/application/testing/identity-context";
import { assembleIdentityModule } from "@/identity/identity.module";

export type CallOptions = {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  token?: string;
  ip?: string;
};

export type IdentityHttp = ReturnType<typeof createIdentityHttp>;

export const createIdentityHttp = () => {
  const ctx = createIdentityContext();
  const identity = assembleIdentityModule(ctx);
  const routes = new HttpRouter()
    .add(identity.publicRoutes)
    .use(identity.authenticate)
    .add(identity.routes)
    .routes();
  const routeStatusFile = inject("routeStatusFile");
  appendFileSync(routeStatusFile, RouteStatusMatrix.declarationLines(routes));

  const logger = new FakeLogger();
  const adapter = new ExpressAdapter({
    dispatcher: new Dispatcher({ parser: new SchemaParser() }),
    errorMapper: new HttpErrorMapper({ logger }),
    logger,
    logContext: new AsyncLocalLogContext(),
  });
  const app = express()
    .set("trust proxy", true)
    .use(express.json())
    .use(adapter.toRouter(routes))
    .use(adapter.errorHandler());

  const call = async (
    method: HttpMethod,
    path: string,
    options: CallOptions = {},
  ): Promise<HttpResponse> => {
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.path === path,
    );
    if (!route) throw new Error(`No identity route ${method} ${path}`);

    const params = options.params ?? {};
    const url = path.replace(/:(\w+)/g, (_, name: string) =>
      encodeURIComponent(String(params[name])),
    );
    const authorization =
      options.token === undefined
        ? {}
        : { authorization: `Bearer ${options.token}` };

    const response = await request(app)
      [method.toLowerCase() as Lowercase<HttpMethod>](url)
      .query(options.query ?? {})
      .set({
        ...options.headers,
        ...authorization,
        "x-forwarded-for": options.ip ?? faker.internet.ip(),
      })
      .send(options.body);
    appendFileSync(
      routeStatusFile,
      RouteStatusMatrix.observationLine(route, response.status),
    );

    if (response.status === 204) return { status: 204 };
    const contentType = response.headers["content-type"];
    return {
      status: response.status,
      headers: { "content-type": contentType },
      body: response.body as unknown,
    };
  };

  const signIn = async (options?: SeedAccountOptions) => {
    const seeded = await seedAccount(ctx, options);
    const { session, refreshToken, actor } = await seedSession(ctx, seeded);
    const token = await ctx.accessToken.issue({
      accountId: seeded.accountId,
      sessionId: session.id.value,
    });
    return { ...seeded, actor, session, refreshToken, token };
  };

  return { ctx, routes, call, signIn, logger };
};
