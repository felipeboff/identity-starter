import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { Handler, Inbound, Middleware, Next } from "../handler";

import { HttpRoute } from "./http-route";
import { HttpRouter } from "./http-router";

class NamedMiddleware extends Middleware<{ deps: { name: string } }> {
  handle(inbound: Inbound, next: Next): Promise<unknown> {
    return next(inbound);
  }
}

class NoopHandler extends Handler<{ output: void }> {
  handle(): Promise<void> {
    return Promise.resolve();
  }
}

const buildRoute = (overrides: Partial<HttpRoute> = {}): HttpRoute => ({
  method: "GET",
  path: `/${faker.lorem.slug()}`,
  status: 200,
  handler: new NoopHandler(),
  ...overrides,
});

const middlewareOf = (name: string) => new NamedMiddleware({ name });

describe("HttpRouter", () => {
  it("keeps the routes in the order they were added", () => {
    const first = buildRoute();
    const second = buildRoute({ method: "POST" });

    const routes = new HttpRouter().add([first]).add([second]).routes();

    expect(routes.map((route) => [route.method, route.path])).toStrictEqual([
      [first.method, first.path],
      [second.method, second.path],
    ]);
  });

  it("runs a middleware only on the routes added after it", () => {
    const authenticate = middlewareOf("authenticate");
    const signIn = buildRoute();
    const me = buildRoute();

    const routes = new HttpRouter()
      .add([signIn])
      .use(authenticate)
      .add([me])
      .routes();

    expect(routes).toStrictEqual([
      { ...signIn, middlewares: [] },
      { ...me, middlewares: [authenticate] },
    ]);
  });

  it("stacks middlewares in order, before the route's own", () => {
    const language = middlewareOf("language");
    const authenticate = middlewareOf("authenticate");
    const audit = middlewareOf("audit");
    const route = buildRoute({ middlewares: [audit] });

    const [registered] = new HttpRouter()
      .use(language)
      .use(authenticate)
      .add([route])
      .routes();

    expect(registered?.middlewares).toStrictEqual([
      language,
      authenticate,
      audit,
    ]);
  });

  it("does not let callers change its table", () => {
    const router = new HttpRouter().add([buildRoute()]);

    (router.routes() as HttpRoute<unknown>[]).pop();

    expect(router.routes()).toHaveLength(1);
  });
});
