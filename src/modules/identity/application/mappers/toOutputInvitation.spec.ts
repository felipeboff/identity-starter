import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { toOutputInvitation } from "./toOutputInvitation";

import { IdentityPermission } from "@/identity/domain/identity.permission";
import { Invitation } from "@/identity/domain/invitation.entity";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("toOutputInvitation", () => {
  it("returns exactly the public fields of an invitation", () => {
    const email = faker.internet.email().toLowerCase();
    const permissions = [IdentityPermission.INVITATION_READ];
    const expiresAt = faker.date.future();
    const at = faker.date.past();
    const invitation = Invitation.register(
      {
        id: faker.database.mongodbObjectId(),
        email,
        role: MembershipRole.USER,
        permissions,
        tokenHash: faker.string.hexadecimal({ length: 64, prefix: "" }),
        expiresAt,
        createdBy: faker.database.mongodbObjectId(),
      },
      at,
    );

    expect(toOutputInvitation(invitation)).toStrictEqual({
      id: invitation.id.value,
      email,
      role: MembershipRole.USER,
      permissions,
      createdAt: at,
      expiresAt,
    });
  });
});
