import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { SharedError } from "../errors/shared.error";

import { Id } from "./id.value-object";

describe("Id", () => {
  const objectId = faker.database.mongodbObjectId();

  it.each([
    ["keeps a lowercase object id", objectId],
    ["lowercases the object id", objectId.toUpperCase()],
    ["trims surrounding whitespace", ` ${objectId} `],
  ])("%s", (_, input) => {
    expect(Id.create(input).value).toBe(objectId);
  });

  it("is equal to another id with the same object id", () => {
    const id = Id.create(objectId);

    expect(id.equals(Id.create(objectId.toUpperCase()))).toBe(true);
    expect(id.equals(Id.create(faker.database.mongodbObjectId()))).toBe(false);
  });

  it.each([
    ["empty", "", SharedError.IdRequired],
    ["undefined", undefined, SharedError.IdRequired],
    ["null", null, SharedError.IdRequired],
    ["not an object id", faker.lorem.word(), SharedError.IdInvalid],
    ["a uuid", faker.string.uuid(), SharedError.IdInvalid],
    ["too short", objectId.slice(1), SharedError.IdInvalid],
  ])("throws when the id is %s", (_, input, error) => {
    expect(() => Id.create(input as string)).toThrow(error.code);
  });
});
