import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { toOutputAccount } from "./toOutputAccount";

describe("toOutputAccount", () => {
  it("returns the account snapshot", async () => {
    const ctx = createIdentityContext();
    const name = faker.person.fullName();
    const email = faker.internet.email().toLowerCase();
    const ana = await seedAccount(ctx, { name, email });

    const output = toOutputAccount(ana.account);

    expect(output).toEqual(ana.account.toSnapshot());
    expect(output).toMatchObject({ name, email });
  });
});
