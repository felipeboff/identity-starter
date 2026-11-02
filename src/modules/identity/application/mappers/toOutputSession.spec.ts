import { describe, expect, it } from "vitest";

import {
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { toOutputSession } from "./toOutputSession";

describe("toOutputSession", () => {
  it("returns exactly the public fields of a session", async () => {
    const ctx = createIdentityContext();
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    expect(toOutputSession(session)).toStrictEqual({
      id: session.id.value,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    });
  });
});
