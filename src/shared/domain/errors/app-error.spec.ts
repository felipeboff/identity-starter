import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { AppError, defineError, isAppError } from "./app-error";

const AccountNotFound = defineError<{ id: string }>(
  "test.account_not_found",
  "not_found",
);
const Conflict = defineError("test.conflict", "conflict");

describe("defineError", () => {
  it("returns the code and kind", () => {
    expect(AccountNotFound).toEqual({
      code: "test.account_not_found",
      kind: "not_found",
    });
  });
});

describe("AppError", () => {
  it("carries the code, kind and data of its definition", () => {
    const id = faker.database.mongodbObjectId();

    const error = new AppError(AccountNotFound, { id });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "AppError",
      message: "test.account_not_found",
      code: "test.account_not_found",
      kind: "not_found",
      data: { id },
    });
  });

  it("has no data when the definition has no payload", () => {
    expect(new AppError(Conflict).data).toBeUndefined();
  });
});

describe("isAppError", () => {
  it.each([
    ["an AppError", new AppError(Conflict), true],
    ["a plain Error", new Error(faker.lorem.sentence()), false],
    ["an object that looks like an AppError", { code: Conflict.code }, false],
    ["null", null, false],
  ])("%s → %s", (_, value, expected) => {
    expect(isAppError(value)).toBe(expected);
  });
});
