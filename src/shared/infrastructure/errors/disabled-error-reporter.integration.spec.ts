import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { DisabledErrorReporter } from "./disabled-error-reporter";

describe("DisabledErrorReporter", () => {
  it("ignores the error", () => {
    const reporter = new DisabledErrorReporter();

    expect(() =>
      reporter.report(new Error(faker.lorem.sentence())),
    ).not.toThrow();
  });
});
