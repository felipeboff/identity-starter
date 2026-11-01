import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { ListCredentialsUseCase } from "./list-credentials.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";

describe("ListCredentialsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ListCredentialsUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ListCredentialsUseCase(ctx);
  });

  const saveOAuthCredential = async (
    accountId: string,
    provider: typeof AuthProvider.GOOGLE | typeof AuthProvider.GITHUB,
  ) => {
    const credential = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId,
        provider,
        subject: faker.string.numeric(21),
      },
      ctx.clock.now(),
    );
    await ctx.credentials.save(credential);
    return credential;
  };

  it("lists the credentials of the account that were not removed", async () => {
    const ana = await seedAccount(ctx);
    ctx.clock.advance(1_000);
    const google = await saveOAuthCredential(
      ana.accountId,
      AuthProvider.GOOGLE,
    );
    const github = await saveOAuthCredential(
      ana.accountId,
      AuthProvider.GITHUB,
    );
    github.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(github);
    const bruno = await seedAccount(ctx);
    await saveOAuthCredential(bruno.accountId, AuthProvider.GOOGLE);

    const output = await useCase.execute(ana.actor);

    expect(output.credentials.map((credential) => credential.id)).toEqual([
      ana.credential.id.value,
      google.id.value,
    ]);
  });

  it("does not expose the password hash", async () => {
    const ana = await seedAccount(ctx);

    const output = await useCase.execute(ana.actor);

    const { passwordHash, ...publicFields } = ana.credential.toSnapshot();
    expect(passwordHash).toBeDefined();
    expect(output.credentials).toStrictEqual([publicFields]);
  });
});
