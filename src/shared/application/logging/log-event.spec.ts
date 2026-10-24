import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { defineLogEvent } from "./log-event";
import { SharedLogEvent } from "./shared.log-event";

describe("defineLogEvent", () => {
  it("returns the event name", () => {
    const name = `${faker.lorem.word()}.${faker.lorem.word()}`;

    expect(defineLogEvent<{ id: string }>(name)).toStrictEqual({ name });
  });
});

describe("SharedLogEvent", () => {
  it("names every event under the shared prefix", () => {
    expect(SharedLogEvent.UnexpectedError.name).toBe("shared.unexpected_error");
  });
});
