import { describe, expect, it } from "vitest";

import {
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { toPublicSession } from "./toPublicSession";

describe("toPublicSession", () => {
  it("returns the session snapshot without the token hash", async () => {
    const ctx = createIdentityContext();
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    const output = toPublicSession(session);

    expect(output).not.toHaveProperty("tokenHash");
    expect(output).toMatchObject({
      id: session.id.value,
      accountId: ana.accountId,
      userAgent: session.userAgent,
      revokedAt: null,
    });
  });
});
