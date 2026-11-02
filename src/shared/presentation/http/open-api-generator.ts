import Type, { type TSchema } from "typebox";

import { NO_INPUT } from "../handler";

import type { HttpFailureStatus, HttpMethod, HttpRoute } from "./http-route";

type RouteMiddleware = NonNullable<HttpRoute<unknown>["middlewares"]>[number];

export type OpenApiGeneratorDeps = Readonly<{
  title: string;
  version: string;
  basePath: string;
  authentication: RouteMiddleware;
}>;

type JsonSchema = Readonly<Record<string, unknown>>;

type ObjectSchema = Readonly<{
  properties: Readonly<Record<string, TSchema>>;
  required?: readonly string[];
}>;

type ParameterLocation = "path" | "query";

export type OpenApiParameter = Readonly<{
  name: string;
  in: ParameterLocation;
  required: boolean;
  schema: JsonSchema;
}>;

export type OpenApiContent = Readonly<
  Record<string, Readonly<{ schema: JsonSchema }>>
>;

export type OpenApiResponse = Readonly<{
  description: string;
  content?: OpenApiContent;
}>;

export type OpenApiOperation = Readonly<{
  operationId: string;
  tags: readonly string[];
  security?: readonly Readonly<Record<string, readonly string[]>>[];
  parameters?: readonly OpenApiParameter[];
  requestBody?: Readonly<{ required: boolean; content: OpenApiContent }>;
  responses: Readonly<Record<string, OpenApiResponse>>;
}>;

export type OpenApiPathItem = Readonly<
  Partial<Record<Lowercase<HttpMethod>, OpenApiOperation>>
>;

export type OpenApiDocument = Readonly<{
  openapi: string;
  info: Readonly<{ title: string; version: string }>;
  servers: readonly Readonly<{ url: string }>[];
  paths: Readonly<Record<string, OpenApiPathItem>>;
  components: Readonly<{
    securitySchemes: Readonly<Record<string, JsonSchema>>;
    schemas: Readonly<Record<string, JsonSchema>>;
  }>;
}>;

const OPENAPI_VERSION = "3.1.0";
const BEARER = "bearer";
const PROBLEM = "Problem";
const JSON_MEDIA = "application/json";
const PROBLEM_MEDIA = "application/problem+json";
const PATH_PARAMETER = /:(\w+)/g;
const BODY_METHODS: ReadonlySet<HttpMethod> = new Set(["POST", "PUT", "PATCH"]);

const STATUS_TEXT: Record<HttpRoute["status"] | HttpFailureStatus, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Content",
  429: "Too Many Requests",
};

const problemSchema = Type.Object({
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer(),
  code: Type.String(),
  data: Type.Optional(Type.Unknown()),
});

export class OpenApiGenerator {
  constructor(private readonly deps: OpenApiGeneratorDeps) {}

  generate(routes: readonly HttpRoute<unknown>[]): OpenApiDocument {
    const paths: Record<string, OpenApiPathItem> = {};
    for (const route of routes) {
      const path = route.path.replace(PATH_PARAMETER, "{$1}");
      paths[path] = {
        ...paths[path],
        [route.method.toLowerCase()]: this.operationOf(route),
      };
    }

    return {
      openapi: OPENAPI_VERSION,
      info: { title: this.deps.title, version: this.deps.version },
      servers: [{ url: this.deps.basePath }],
      paths,
      components: {
        securitySchemes: {
          [BEARER]: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
        schemas: { [PROBLEM]: this.toJson(problemSchema) },
      },
    };
  }

  private operationOf(route: HttpRoute<unknown>): OpenApiOperation {
    const input = (route.handler.input ?? NO_INPUT) as ObjectSchema;
    const pathNames = [...route.path.matchAll(PATH_PARAMETER)].map(
      ([, name]) => name,
    );
    const fields = Object.keys(input.properties).filter(
      (name) => !pathNames.includes(name),
    );
    const inBody = BODY_METHODS.has(route.method);
    const parameters = [
      ...pathNames.map((name) => this.parameterOf(input, name, "path")),
      ...(inBody
        ? []
        : fields.map((name) => this.parameterOf(input, name, "query"))),
    ];
    const bodyFields = inBody ? fields : [];

    return {
      operationId: route.handler.name,
      tags: [route.handler.name.split(".")[0]],
      ...(this.isAuthenticated(route) ? { security: [{ [BEARER]: [] }] } : {}),
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(bodyFields.length > 0
        ? {
            requestBody: {
              required: bodyFields.some((name) => this.isRequired(input, name)),
              content: {
                [JSON_MEDIA]: { schema: this.bodySchemaOf(input, bodyFields) },
              },
            },
          }
        : {}),
      responses: this.responsesOf(route),
    };
  }

  private parameterOf(
    input: ObjectSchema,
    name: string,
    location: ParameterLocation,
  ): OpenApiParameter {
    const schema = input.properties[name];
    return {
      name,
      in: location,
      required: location === "path" || this.isRequired(input, name),
      schema: schema === undefined ? { type: "string" } : this.toJson(schema),
    };
  }

  private bodySchemaOf(
    input: ObjectSchema,
    names: readonly string[],
  ): JsonSchema {
    const required = names.filter((name) => this.isRequired(input, name));
    return this.toJson({
      ...input,
      properties: Object.fromEntries(
        names.map((name) => [name, input.properties[name]]),
      ),
      required: required.length > 0 ? required : undefined,
    });
  }

  private responsesOf(
    route: HttpRoute<unknown>,
  ): Record<string, OpenApiResponse> {
    const problem = {
      [PROBLEM_MEDIA]: { schema: { $ref: `#/components/schemas/${PROBLEM}` } },
    };
    const output = route.handler.output;
    const responses: Record<string, OpenApiResponse> = {
      [route.status]: {
        description: STATUS_TEXT[route.status],
        ...(output === undefined
          ? {}
          : { content: { [JSON_MEDIA]: { schema: this.toJson(output) } } }),
      },
    };
    for (const status of route.failures) {
      responses[status] = {
        description: STATUS_TEXT[status],
        content: problem,
      };
    }
    return responses;
  }

  private isAuthenticated(route: HttpRoute<unknown>): boolean {
    return (route.middlewares ?? []).includes(this.deps.authentication);
  }

  private isRequired(input: ObjectSchema, name: string): boolean {
    return (input.required ?? []).includes(name);
  }

  /** Drops TypeBox's non-enumerable markers and refine/codec functions. */
  private toJson(schema: unknown): JsonSchema {
    return JSON.parse(JSON.stringify(schema)) as JsonSchema;
  }
}
