import { describe, expect, it } from "vitest";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password.policy";

describe("password policy", () => {
  it("asks for 12 to 128 characters", () => {
    expect([PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH]).toStrictEqual([12, 128]);
  });
});
