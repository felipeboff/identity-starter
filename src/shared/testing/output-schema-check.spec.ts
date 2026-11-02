import { faker } from "@faker-js/faker";
import Type, { type TSchema } from "typebox";
import { describe, expect, it } from "vitest";

import { OutputSchemaCheck } from "./output-schema-check";

const field = () => faker.string.alpha({ length: 10, casing: "lower" });

const buildRoute = (output?: TSchema, status: 200 | 201 | 204 = 200) => ({
  method: "GET" as const,
  path: `/${faker.lorem.slug()}`,
  status,
  handler: { output },
});

describe("OutputSchemaCheck", () => {
  const name = field();
  const schema = Type.Object({ [name]: Type.String() });

  it("accepts a success body that matches the output schema exactly", () => {
    const route = buildRoute(schema);

    expect(() =>
      OutputSchemaCheck.assert(route, {
        status: route.status,
        body: { [name]: faker.lorem.word() },
      }),
    ).not.toThrow();
  });

  it("ignores a failure answer and a route without body", () => {
    const route = buildRoute(schema);
    const noBody = buildRoute(undefined, 204);

    expect(() =>
      OutputSchemaCheck.assert(route, {
        status: 400,
        body: { code: faker.lorem.word() },
      }),
    ).not.toThrow();
    expect(() =>
      OutputSchemaCheck.assert(noBody, { status: 204, body: undefined }),
    ).not.toThrow();
  });

  it("refuses a route that answers a body with no output schema", () => {
    const route = buildRoute();

    expect(() =>
      OutputSchemaCheck.assert(route, { status: route.status, body: {} }),
    ).toThrow(
      `${route.method} ${route.path} answers a body with no output schema`,
    );
  });

  it.each([
    ["a field of the wrong type", () => ({ [name]: faker.number.int() })],
    [
      "a field the schema does not describe",
      () => ({ [name]: faker.lorem.word(), [field()]: faker.lorem.word() }),
    ],
  ])("refuses a body with %s", (_case, buildBody) => {
    const route = buildRoute(schema);

    expect(() =>
      OutputSchemaCheck.assert(route, {
        status: route.status,
        body: buildBody(),
      }),
    ).toThrow(
      `${route.method} ${route.path} answered outside its output schema`,
    );
  });
});
