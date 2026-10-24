import { faker } from "@faker-js/faker";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { HttpErrorMapper } from "@shared/presentation/http/http-error-mapper";
import { HttpResponse } from "@shared/presentation/http/http-response";
import { HttpMethod } from "@shared/presentation/http/http-route";
import { HttpRouter } from "@shared/presentation/http/http-router";
import { FakeLogger } from "@shared/testing/fake-logger";

import {
  SeedAccountOptions,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "@/identity/application/testing/identity-context";
import { createIdentityModule } from "@/identity/identity.module";

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
  const identity = createIdentityModule(ctx);
  const routes = new HttpRouter()
    .add(identity.publicRoutes)
    .use(identity.authenticate)
    .add(identity.routes)
    .routes();

  const logger = new FakeLogger();
  const dispatcher = new Dispatcher();
  const errorMapper = new HttpErrorMapper({ logger });

  const call = async (
    method: HttpMethod,
    path: string,
    options: CallOptions = {},
  ): Promise<HttpResponse> => {
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.path === path,
    );
    if (!route) throw new Error(`No identity route ${method} ${path}`);

    const authorization =
      options.token === undefined
        ? {}
        : { authorization: `Bearer ${options.token}` };

    try {
      const output = await dispatcher.dispatch(route, {
        input: { ...options.query, ...options.body, ...options.params },
        metadata: { ...options.headers, ...authorization },
        ip: options.ip ?? faker.internet.ip(),
        actor: undefined,
      });
      return route.status === 204
        ? { status: 204 }
        : { status: route.status, body: output };
    } catch (error) {
      return errorMapper.map(error);
    }
  };

  const signIn = async (options?: SeedAccountOptions) => {
    const seeded = await seedAccount(ctx, options);
    const { session, refreshToken, actor } = await seedSession(ctx, seeded);
    const token = ctx.accessToken.issue({
      accountId: seeded.accountId,
      sessionId: session.id.value,
    });
    return { ...seeded, actor, session, refreshToken, token };
  };

  return { ctx, routes, call, signIn, logger };
};
