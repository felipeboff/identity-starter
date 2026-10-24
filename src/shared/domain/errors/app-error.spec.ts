import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { AppError, defineError, isAppError } from "./app-error";

const accountNotFoundCode = `${faker.lorem.word()}.${faker.lorem.word()}`;
const AccountNotFound = defineError<{ id: string }>(
  accountNotFoundCode,
  "not_found",
);
const Conflict = defineError(
  `${faker.lorem.word()}.${faker.lorem.word()}`,
  "conflict",
);

describe("defineError", () => {
  it("returns the code and kind", () => {
    expect(AccountNotFound).toEqual({
      code: accountNotFoundCode,
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
      message: accountNotFoundCode,
      code: accountNotFoundCode,
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
