import { faker } from "@faker-js/faker";
import express, { type ErrorRequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { HealthAdapter, type Readiness } from "./health-adapter";

const appWith = (readiness: Readiness, errors: unknown[] = []) => {
  // Express treats a handler as an error handler only when it declares four parameters.
  const recordError: ErrorRequestHandler = (error, _req, res, _next) => {
    errors.push(error);
    res.status(500).end();
  };
  return express()
    .get("/", new HealthAdapter({ readiness }).handler())
    .use(recordError);
};

describe("HealthAdapter", () => {
  it("answers ok when the dependencies are ready", async () => {
    const app = appWith({ isReady: () => Promise.resolve(true) });

    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ status: "ok" });
  });

  it("answers unavailable with 503 when they are not", async () => {
    const app = appWith({ isReady: () => Promise.resolve(false) });

    const response = await request(app).get("/");

    expect(response.status).toBe(503);
    expect(response.body).toStrictEqual({ status: "unavailable" });
  });

  it("hands a failed readiness check to the error handler", async () => {
    const failure = new Error(faker.lorem.sentence());
    const errors: unknown[] = [];
    const app = appWith({ isReady: () => Promise.reject(failure) }, errors);

    const response = await request(app).get("/");

    expect(response.status).toBe(500);
    expect(errors).toStrictEqual([failure]);
  });
});
