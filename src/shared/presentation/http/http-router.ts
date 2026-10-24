import type { Entry } from "../handler";

import type { HttpRoute } from "./http-route";

type RouteMiddleware = NonNullable<Entry["middlewares"]>[number];

/**
 * Ordered route table. Registration order is the access rule: a middleware
 * passed to `use` runs on every route added after it, never on the ones before.
 */
export class HttpRouter {
  private readonly middlewares: RouteMiddleware[] = [];
  private readonly table: HttpRoute<unknown>[] = [];

  use(middleware: RouteMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  add(routes: readonly HttpRoute<unknown>[]): this {
    for (const route of routes) {
      this.table.push({
        ...route,
        middlewares: [...this.middlewares, ...(route.middlewares ?? [])],
      });
    }
    return this;
  }

  routes(): readonly HttpRoute<unknown>[] {
    return [...this.table];
  }
}
