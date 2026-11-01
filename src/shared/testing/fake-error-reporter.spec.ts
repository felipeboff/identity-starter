import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { FakeErrorReporter } from "./fake-error-reporter";

describe("FakeErrorReporter", () => {
  it("records every reported error in order", () => {
    const reporter = new FakeErrorReporter();
    const first = new Error(faker.lorem.sentence());
    const second = faker.lorem.word();

    reporter.report(first);
    reporter.report(second);

    expect(reporter.reported).toStrictEqual([first, second]);
  });
});
