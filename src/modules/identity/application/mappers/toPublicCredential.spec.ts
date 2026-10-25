import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { toPublicCredential } from "./toPublicCredential";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";

describe("toPublicCredential", () => {
  it("returns the e-mail credential without the password hash", async () => {
    const ctx = createIdentityContext();
    const ana = await seedAccount(ctx);

    const output = toPublicCredential(ana.credential);

    expect(output).not.toHaveProperty("passwordHash");
    expect(output).toEqual({
      id: ana.credential.id.value,
      accountId: ana.accountId,
      provider: AuthProvider.EMAIL,
      subject: ana.email,
      providerEmail: ana.email,
      version: 1,
      createdAt: ana.credential.createdAt,
      updatedAt: ana.credential.updatedAt,
      deletedAt: null,
    });
  });

  it("returns an OAuth credential without the password hash", () => {
    const subject = faker.string.numeric(21);
    const google = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        provider: AuthProvider.GOOGLE,
        subject,
      },
      faker.date.recent(),
    );

    const output = toPublicCredential(google);

    expect(output).not.toHaveProperty("passwordHash");
    expect(output).toMatchObject({
      provider: AuthProvider.GOOGLE,
      subject,
      providerEmail: null,
    });
  });
});
