import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { HttpFailureStatus } from "../presentation/http/http-route";

import { RouteStatusMatrix } from "./route-status-matrix";

const buildRoute = (failures: HttpFailureStatus[] = [400, 404]) => ({
  method: "POST" as const,
  path: `/${faker.lorem.slug()}`,
  status: 201 as const,
  failures,
});

const matrixOf = (...lines: string[]) =>
  RouteStatusMatrix.parse(lines.join(""));

describe("RouteStatusMatrix", () => {
  it("has no gap when every declared status was observed", () => {
    const route = buildRoute();

    const matrix = matrixOf(
      RouteStatusMatrix.declarationLines([route]),
      RouteStatusMatrix.observationLine(route, 201),
      RouteStatusMatrix.observationLine(route, 400),
      RouteStatusMatrix.observationLine(route, 404),
    );

    expect(matrix.missing()).toStrictEqual([]);
    expect(matrix.undeclared()).toStrictEqual([]);
  });

  it("lists every declared status no test observed", () => {
    const route = buildRoute();

    const matrix = matrixOf(
      RouteStatusMatrix.declarationLines([route]),
      RouteStatusMatrix.observationLine(route, 400),
    );

    expect(matrix.missing()).toStrictEqual([
      `POST ${route.path} 201`,
      `POST ${route.path} 404`,
    ]);
  });

  it("lists an observed status the route does not declare", () => {
    const route = buildRoute([]);

    const matrix = matrixOf(
      RouteStatusMatrix.declarationLines([route]),
      RouteStatusMatrix.observationLine(route, 201),
      RouteStatusMatrix.observationLine(route, 409),
    );

    expect(matrix.undeclared()).toStrictEqual([`POST ${route.path} 409`]);
  });

  it("ignores server errors, which no route declares", () => {
    const route = buildRoute([]);

    expect(RouteStatusMatrix.observationLine(route, 500)).toBe("");
  });

  it("counts a status declared or observed many times once", () => {
    const route = buildRoute([]);
    const declared = RouteStatusMatrix.declarationLines([route]);
    const observed = RouteStatusMatrix.observationLine(route, 201);

    const matrix = matrixOf(declared, declared, observed, observed);

    expect(matrix.missing()).toStrictEqual([]);
    expect(matrix.undeclared()).toStrictEqual([]);
  });
});
