import { faker } from "@faker-js/faker";
import {
  Handler,
  Inbound,
  Middleware,
  Next,
} from "@shared/presentation/handler";
import { HttpRoute } from "@shared/presentation/http/http-route";
import { describe, expect, it } from "vitest";

import { createHttpRoutes } from "./http-routes";

import { IdentityModule } from "@/identity/identity.module";

class NoopHandler extends Handler<{ output: void }> {
  readonly name = "test.noop";

  handle(): Promise<void> {
    return Promise.resolve();
  }
}

class PassMiddleware extends Middleware {
  handle(inbound: Inbound, next: Next): Promise<unknown> {
    return next(inbound);
  }
}

const buildRoute = (): HttpRoute => ({
  method: "POST",
  path: `/${faker.lorem.slug()}`,
  status: 200,
  failures: [],
  handler: new NoopHandler(),
});

describe("createHttpRoutes", () => {
  it("registers identity's public routes, then authentication, then its other routes", () => {
    const signIn = buildRoute();
    const getMe = buildRoute();
    const authenticate = new PassMiddleware();

    const routes = createHttpRoutes({
      identity: {
        authenticate,
        publicRoutes: [signIn],
        routes: [getMe],
      } as unknown as IdentityModule,
    });

    expect(routes).toStrictEqual([
      { ...signIn, middlewares: [] },
      { ...getMe, middlewares: [authenticate] },
    ]);
  });
});
