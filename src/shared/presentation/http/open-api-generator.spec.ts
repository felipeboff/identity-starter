import { faker } from "@faker-js/faker";
import Type, { type TSchema } from "typebox";
import { describe, expect, it } from "vitest";

import { dateSchema, dateTimeSchema } from "../date.schema";
import { Handler, Inbound, Middleware, Next } from "../handler";

import { HttpRoute } from "./http-route";
import { OpenApiGenerator } from "./open-api-generator";

class PassMiddleware extends Middleware {
  handle(inbound: Inbound, next: Next): Promise<unknown> {
    return next(inbound);
  }
}

const buildName = () => `${faker.lorem.word()}.${faker.string.alpha(10)}`;

class NoInputHandler extends Handler {
  constructor(readonly name = buildName()) {
    super();
  }

  handle(): Promise<void> {
    return Promise.resolve();
  }
}

class InputHandler extends Handler<{ input: TSchema }> {
  readonly name = buildName();

  constructor(readonly input: TSchema) {
    super();
  }

  handle(): Promise<void> {
    return Promise.resolve();
  }
}

class OutputHandler extends Handler<{ output: TSchema }> {
  readonly name = buildName();

  constructor(readonly output: TSchema) {
    super();
  }

  handle(): Promise<unknown> {
    return Promise.resolve(undefined);
  }
}

const field = () => faker.string.alpha({ length: 12, casing: "lower" });

const segment = () => faker.string.alpha({ length: 8, casing: "lower" });

const buildRoute = (overrides: Partial<HttpRoute> = {}): HttpRoute => ({
  method: "GET",
  path: `/${segment()}`,
  status: 200,
  failures: [],
  handler: new NoInputHandler(),
  ...overrides,
});

const PROBLEM_CONTENT = {
  "application/problem+json": {
    schema: { $ref: "#/components/schemas/Problem" },
  },
};

describe("OpenApiGenerator", () => {
  const authentication = new PassMiddleware();
  const deps = {
    title: faker.internet.domainWord(),
    version: faker.system.semver(),
    basePath: `/${segment()}`,
    authentication,
  };
  const generator = new OpenApiGenerator(deps);

  const operationOf = (route: HttpRoute) => {
    const path = route.path.replace(/:(\w+)/g, "{$1}");
    const method = route.method.toLowerCase() as "get";
    return generator.generate([route]).paths[path]?.[method];
  };

  it("describes the API, its server and the shared components", () => {
    expect(generator.generate([])).toStrictEqual({
      openapi: "3.1.0",
      info: { title: deps.title, version: deps.version },
      servers: [{ url: deps.basePath }],
      paths: {},
      components: {
        securitySchemes: {
          bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
        schemas: {
          Problem: {
            type: "object",
            required: ["type", "title", "status", "code"],
            properties: {
              type: { type: "string" },
              title: { type: "string" },
              status: { type: "integer" },
              code: { type: "string" },
              data: {},
            },
          },
        },
      },
    });
  });

  it("names the operation after its handler and tags it with the module", () => {
    const module = segment();
    const name = `${module}.${segment()}`;
    const route = buildRoute({
      status: 201,
      handler: new NoInputHandler(name),
    });

    expect(operationOf(route)).toStrictEqual({
      operationId: name,
      tags: [module],
      responses: { "201": { description: "Created" } },
    });
  });

  it("puts every method of a path under the same template", () => {
    const path = `/${segment()}`;
    const read = buildRoute({ path });
    const remove = buildRoute({ path, method: "DELETE", status: 204 });

    const { paths } = generator.generate([read, remove]);

    expect(Object.keys(paths)).toStrictEqual([path]);
    expect(Object.keys(paths[path] ?? {})).toStrictEqual(["get", "delete"]);
  });

  it("templates the path parameters and types them by the input schema", () => {
    const typed = field();
    const untyped = field();
    const route = buildRoute({
      method: "DELETE",
      path: `/${segment()}/:${typed}/${segment()}/:${untyped}`,
      handler: new InputHandler(
        Type.Object({ [typed]: Type.String({ format: "uuid" }) }),
      ),
    });

    expect(operationOf(route)?.parameters).toStrictEqual([
      {
        name: typed,
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      { name: untyped, in: "path", required: true, schema: { type: "string" } },
    ]);
  });

  it("reads the other input fields of a GET from the query", () => {
    const limit = field();
    const after = field();
    const route = buildRoute({
      handler: new InputHandler(
        Type.Object({
          [limit]: Type.Integer({ minimum: 1 }),
          [after]: Type.Optional(dateSchema),
        }),
      ),
    });

    const operation = operationOf(route);

    expect(operation?.parameters).toStrictEqual([
      {
        name: limit,
        in: "query",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
      { name: after, in: "query", required: false, schema: {} },
    ]);
    expect(operation).not.toHaveProperty("requestBody");
  });

  it("sends the other input fields of a POST in a JSON body", () => {
    const id = field();
    const name = field();
    const note = field();
    const route = buildRoute({
      method: "POST",
      path: `/${segment()}/:${id}`,
      handler: new InputHandler(
        Type.Object({
          [id]: Type.String(),
          [name]: Type.String({ minLength: 1 }),
          [note]: Type.Optional(Type.String()),
        }),
      ),
    });

    const operation = operationOf(route);

    expect(operation?.parameters).toStrictEqual([
      { name: id, in: "path", required: true, schema: { type: "string" } },
    ]);
    expect(operation?.requestBody).toStrictEqual({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: [name],
            properties: {
              [name]: { type: "string", minLength: 1 },
              [note]: { type: "string" },
            },
          },
        },
      },
    });
  });

  it("marks the body optional when every field is", () => {
    const note = field();
    const route = buildRoute({
      method: "PATCH",
      handler: new InputHandler(
        Type.Object({ [note]: Type.Optional(Type.String()) }),
      ),
    });

    expect(operationOf(route)?.requestBody).toStrictEqual({
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { [note]: { type: "string" } },
          },
        },
      },
    });
  });

  it("leaves out the body when the input has no field outside the path", () => {
    const id = field();
    const route = buildRoute({
      method: "PUT",
      path: `/${segment()}/:${id}`,
      handler: new InputHandler(Type.Object({ [id]: Type.String() })),
    });

    expect(operationOf(route)).not.toHaveProperty("requestBody");
  });

  it("asks for the bearer token only where the authentication middleware runs", () => {
    const authenticated = buildRoute({ middlewares: [authentication] });
    const other = buildRoute({ middlewares: [new PassMiddleware()] });

    expect(operationOf(authenticated)?.security).toStrictEqual([
      { bearer: [] },
    ]);
    expect(operationOf(other)).not.toHaveProperty("security");
  });

  it("describes the success body with the handler's output schema, dates as strings", () => {
    const at = field();
    const route = buildRoute({
      status: 201,
      handler: new OutputHandler(
        Type.Object({
          [at]: Type.Union([dateTimeSchema, Type.Null()]),
        }),
      ),
    });

    expect(operationOf(route)?.responses).toStrictEqual({
      "201": {
        description: "Created",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: [at],
              properties: {
                [at]: {
                  anyOf: [
                    { type: "string", format: "date-time" },
                    { type: "null" },
                  ],
                },
              },
            },
          },
        },
      },
    });
  });

  it("answers each declared failure with a problem details body", () => {
    const route = buildRoute({ status: 204, failures: [400, 401, 429] });

    expect(operationOf(route)?.responses).toStrictEqual({
      "204": { description: "No Content" },
      "400": { description: "Bad Request", content: PROBLEM_CONTENT },
      "401": { description: "Unauthorized", content: PROBLEM_CONTENT },
      "429": { description: "Too Many Requests", content: PROBLEM_CONTENT },
    });
  });
});
