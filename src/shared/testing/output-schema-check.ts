import { isDeepStrictEqual } from "node:util";

import Value from "typebox/value";

import type { HttpRoute } from "../presentation/http/http-route";

type CheckedRoute = Pick<HttpRoute<unknown>, "method" | "path" | "status"> &
  Readonly<{ handler: Pick<HttpRoute<unknown>["handler"], "output"> }>;

export type CheckedResponse = Readonly<{ status: number; body: unknown }>;

export class OutputSchemaCheck {
  static assert(route: CheckedRoute, response: CheckedResponse): void {
    if (response.status !== route.status || route.status === 204) return;

    const output = route.handler.output;
    if (output === undefined) {
      throw new Error(
        `${route.method} ${route.path} answers a body with no output schema`,
      );
    }
    const errors = Value.Errors(output, response.body);
    const cleaned: unknown = Value.Clean(output, Value.Clone(response.body));
    if (errors.length > 0 || !isDeepStrictEqual(cleaned, response.body)) {
      throw new Error(
        `${route.method} ${route.path} answered outside its output schema: ${JSON.stringify({ errors, body: response.body })}`,
      );
    }
  }
}
