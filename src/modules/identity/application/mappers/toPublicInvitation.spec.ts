import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { toPublicInvitation } from "./toPublicInvitation";

import { Invitation } from "@/identity/domain/invitation.entity";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("toPublicInvitation", () => {
  it("returns the invitation snapshot without the token hash", () => {
    const invitation = Invitation.register(
      {
        id: faker.database.mongodbObjectId(),
        email: faker.internet.email().toLowerCase(),
        role: MembershipRole.USER,
        permissions: [],
        tokenHash: faker.string.hexadecimal({ length: 64, prefix: "" }),
        expiresAt: faker.date.future(),
        createdBy: faker.database.mongodbObjectId(),
      },
      faker.date.past(),
    );

    const { tokenHash, ...rest } = invitation.toSnapshot();

    expect(tokenHash).toBeDefined();
    expect(toPublicInvitation(invitation)).toStrictEqual(rest);
  });
});
