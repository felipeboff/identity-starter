import { describe, expect, it } from "vitest";

import { IdentityPermission } from "./identity.permission";

describe("IdentityPermission", () => {
  it("names identity's eleven codes with the identity prefix", () => {
    expect(Object.values(IdentityPermission)).toStrictEqual([
      "identity.invitation.create",
      "identity.invitation.read",
      "identity.invitation.revoke",
      "identity.account.reactivate",
      "identity.account.deactivate",
      "identity.session.read",
      "identity.session.revoke",
      "identity.session.revoke_all",
      "identity.member.read",
      "identity.member.role.update",
      "identity.member.permissions.update",
    ]);
  });
});
