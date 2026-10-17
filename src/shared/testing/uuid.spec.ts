import { describe, expect, test } from "vitest";

import { UUID_OPTIONS, fakeUuid } from "./uuid";

describe("fakeUuid", () => {
  test("generates a uuid v7 with the default options", () => {
    const uuid = fakeUuid();

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test("generates a uuid with the given options", () => {
    const uuid = fakeUuid(UUID_OPTIONS);

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
