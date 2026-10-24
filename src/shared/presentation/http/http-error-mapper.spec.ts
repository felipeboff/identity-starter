import { faker } from "@faker-js/faker";
import { AppError, defineError } from "@shared/domain/errors/app-error";
import type { ErrorKind } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import { describe, expect, it, vi } from "vitest";

import { HttpErrorMapper } from "./http-error-mapper";

const PROBLEM_HEADERS = { "content-type": "application/problem+json" };

const INTERNAL_ERROR_RESPONSE = {
  status: 500,
  headers: PROBLEM_HEADERS,
  body: {
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    code: "shared.internal",
  },
};

const createMapper = (report: (error: unknown) => void = () => {}) => {
  const errorReporter = { report: vi.fn(report) };
  return { mapper: new HttpErrorMapper({ errorReporter }), errorReporter };
};

describe("HttpErrorMapper", () => {
  it.each<[ErrorKind, number]>([
    ["invalid_input", 400],
    ["unauthenticated", 401],
    ["forbidden", 403],
    ["not_found", 404],
    ["conflict", 409],
    ["precondition_failed", 422],
  ])("maps the kind %s to status %i", (kind, status) => {
    const { mapper } = createMapper();
    const code = `${faker.lorem.word()}.${faker.lorem.word()}`;

    const out = mapper.map(new AppError(defineError(code, kind)));

    expect(out.status).toBe(status);
  });

  it("answers an AppError with its problem details and data", () => {
    const { mapper, errorReporter } = createMapper();
    const sessionId = faker.database.mongodbObjectId();
    const SessionExpired = defineError<{ sessionId: string }>(
      "identity.session_expired",
      "precondition_failed",
    );

    const out = mapper.map(new AppError(SessionExpired, { sessionId }));

    expect(out).toStrictEqual({
      status: 422,
      headers: PROBLEM_HEADERS,
      body: {
        type: "tag:resolve-hub,2026:identity.session_expired",
        title: "Session expired",
        status: 422,
        code: "identity.session_expired",
        data: { sessionId },
      },
    });
    expect(errorReporter.report).not.toHaveBeenCalled();
  });

  it("leaves data out when the AppError has none", () => {
    const { mapper } = createMapper();
    const InvalidRefreshToken = defineError(
      "identity.invalid_refresh_token",
      "unauthenticated",
    );

    const out = mapper.map(new AppError(InvalidRefreshToken));

    expect(out.body).toStrictEqual({
      type: "tag:resolve-hub,2026:identity.invalid_refresh_token",
      title: "Invalid refresh token",
      status: 401,
      code: "identity.invalid_refresh_token",
    });
  });

  it("keeps the violations of an invalid input", () => {
    const { mapper } = createMapper();
    const violations = [
      { field: faker.lorem.word(), reason: faker.lorem.word() },
    ];

    const out = mapper.map(
      new AppError(SharedError.InputInvalid, { violations }),
    );

    expect(out).toMatchObject({
      status: 400,
      body: { code: SharedError.InputInvalid.code, data: { violations } },
    });
  });

  it.each([
    ["an Error", new Error(faker.lorem.sentence())],
    ["a string", faker.lorem.word()],
    ["undefined", undefined],
  ])("answers 500 and reports %s", (_, error) => {
    const { mapper, errorReporter } = createMapper();

    const out = mapper.map(error);

    expect(out).toStrictEqual(INTERNAL_ERROR_RESPONSE);
    expect(errorReporter.report).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("still answers 500 when the reporter throws", () => {
    const { mapper } = createMapper(() => {
      throw new Error(faker.lorem.sentence());
    });

    const out = mapper.map(new Error(faker.lorem.sentence()));

    expect(out).toStrictEqual(INTERNAL_ERROR_RESPONSE);
  });
});
