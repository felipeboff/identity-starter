import { describe, expect, it } from "vitest";

import {
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { toOutputMembership } from "./toOutputMembership";

import { MembershipRole } from "@/identity/domain/membership.entity";

describe("toOutputMembership", () => {
  it("returns the membership snapshot", async () => {
    const ctx = createIdentityContext();
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });

    const output = toOutputMembership(admin.membership);

    expect(output).toEqual(admin.membership.toSnapshot());
    expect(output.role).toBe(MembershipRole.ADMIN);
  });
});
