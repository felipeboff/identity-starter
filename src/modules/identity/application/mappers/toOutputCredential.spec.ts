import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { toOutputCredential } from "./toOutputCredential";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";

describe("toOutputCredential", () => {
  it("returns exactly the public fields of an e-mail credential", async () => {
    const ctx = createIdentityContext();
    const ana = await seedAccount(ctx);

    expect(toOutputCredential(ana.credential)).toStrictEqual({
      id: ana.credential.id.value,
      provider: AuthProvider.EMAIL,
      providerEmail: ana.email,
      createdAt: ana.credential.createdAt,
      updatedAt: ana.credential.updatedAt,
    });
  });

  it("returns a null providerEmail when the provider shared none", () => {
    const credential = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        provider: AuthProvider.GITHUB,
        subject: faker.string.numeric(8),
        providerEmail: null,
      },
      faker.date.past(),
    );

    expect(toOutputCredential(credential).providerEmail).toBeNull();
  });
});
