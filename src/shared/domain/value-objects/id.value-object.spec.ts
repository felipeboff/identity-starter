import { faker } from "@faker-js/faker";
import { describe, expect, test } from "vitest";

import { AppError } from "../errors/app-error";
import { SharedError } from "../errors/shared.error";

import { Id } from "./id.value-object";

describe("Id Value Object", () => {
  test("creates an id with the given uuid", () => {
    const uuid = faker.string.uuid({ version: 7 });
    const id = Id.create(uuid);
    expect(id.value).toBe(uuid);
  });

  test("creates an id with the given uuid in lowercase", () => {
    const uuid = faker.string.uuid({ version: 7 }).toUpperCase();
    const id = Id.create(uuid);
    expect(id.value).toBe(uuid.toLowerCase());
  });

  test("considers different uuids as not equal", () => {
    const firstUuid = faker.string.uuid({ version: 7 });
    const secondUuid = faker.string.uuid({ version: 7 });

    const firstId = Id.create(firstUuid);
    const secondId = Id.create(secondUuid);

    expect(secondId.equals(firstId)).toBe(false);
  });

  test("considers the same uuid as equal", () => {
    const uuid = faker.string.uuid({ version: 7 });
    const id = Id.create(uuid);
    const otherId = Id.create(uuid);

    expect(id.equals(otherId)).toBe(true);
  });

  test("throws when id is invalid", () => {
    const invalidUuid = "invalid-uuid";

    expect(() => Id.create(invalidUuid)).toThrow(AppError);
    expect(() => Id.create(invalidUuid)).toThrow(SharedError.IdInvalid.code);
  });

  test("throws when id is empty", () => {
    const emptyUuid = "";

    expect(() => Id.create(emptyUuid)).toThrow(AppError);
    expect(() => Id.create(emptyUuid)).toThrow(SharedError.IdRequired.code);
  });

  test("throws when id is undefined", () => {
    expect(() => Id.create(undefined as never)).toThrow(AppError);
    expect(() => Id.create(undefined as never)).toThrow(
      SharedError.IdRequired.code,
    );
  });

  test("throws when id is null", () => {
    expect(() => Id.create(null as never)).toThrow(AppError);
    expect(() => Id.create(null as never)).toThrow(SharedError.IdRequired.code);
  });

  test("trims trailing whitespace from the id", () => {
    const uuid = faker.string.uuid({ version: 7 });
    const uuidWithTrailingSpace = uuid + " ";

    const id = Id.create(uuidWithTrailingSpace);
    expect(id.value).toBe(uuid);
  });
});
