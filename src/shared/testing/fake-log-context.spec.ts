import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { FakeLogContext } from "./fake-log-context";

describe("FakeLogContext", () => {
  it("records every added set of fields in order", () => {
    const context = new FakeLogContext();
    const first = { accountId: faker.database.mongodbObjectId() };
    const second = { route: `/${faker.lorem.slug()}` };

    context.add(first);
    context.add(second);

    expect(context.added).toStrictEqual([first, second]);
  });
});
