import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { toOutputAccount } from "./toOutputAccount";

describe("toOutputAccount", () => {
  it("returns exactly the public fields of an active account", async () => {
    const ctx = createIdentityContext();
    const name = faker.person.fullName();
    const email = faker.internet.email().toLowerCase();
    const ana = await seedAccount(ctx, { name, email });

    expect(toOutputAccount(ana.account)).toStrictEqual({
      id: ana.accountId,
      name,
      email,
      emailVerifiedAt: null,
      lastSeenAt: null,
      createdAt: ana.account.createdAt,
      deactivatedAt: null,
    });
  });

  it("names the deactivation date deactivatedAt", async () => {
    const ctx = createIdentityContext();
    const ana = await seedAccount(ctx);
    const at = faker.date.recent();
    ana.account.markAsDeleted(at);

    expect(toOutputAccount(ana.account).deactivatedAt).toBe(at);
  });

  it("carries the verification and last-seen dates", async () => {
    const ctx = createIdentityContext();
    const ana = await seedAccount(ctx);
    const verifiedAt = faker.date.recent();
    const seenAt = faker.date.recent();
    ana.account.markEmailAsVerified(verifiedAt);
    ana.account.markAsLastSeen(seenAt);

    expect(toOutputAccount(ana.account)).toMatchObject({
      emailVerifiedAt: verifiedAt,
      lastSeenAt: seenAt,
    });
  });
});
