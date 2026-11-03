import { describe, expect, it } from "vitest";

import {
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { toOutputMembership } from "./toOutputMembership";

import { IdentityPermission } from "@/identity/domain/identity.permission";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("toOutputMembership", () => {
  it("returns exactly the public fields of a membership", async () => {
    const ctx = createIdentityContext();
    const permissions = [IdentityPermission.MEMBER_READ];
    const ana = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions,
    });

    expect(toOutputMembership(ana.membership)).toStrictEqual({
      id: ana.membership.id.value,
      accountId: ana.accountId,
      role: MembershipRole.ADMIN,
      permissions,
      updatedAt: ana.membership.updatedAt,
    });
  });
});
