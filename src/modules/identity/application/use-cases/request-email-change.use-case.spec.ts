import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";
import { EMAIL_CHANGE_TTL_MS } from "../token.policy";

import { RequestEmailChangeUseCase } from "./request-email-change.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("RequestEmailChangeUseCase", () => {
  let ctx: IdentityContext;
  let useCase: RequestEmailChangeUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new RequestEmailChangeUseCase(ctx);
  });

  const newEmail = () => faker.internet.email().toLowerCase();

  it("stores a pending change and e-mails the link to the new address", async () => {
    const ana = await seedAccount(ctx);
    const to = newEmail();

    await useCase.execute({ newEmail: to, password: ana.password }, ana.actor);

    const expiresAt = new Date(ctx.clock.now().getTime() + EMAIL_CHANGE_TTL_MS);
    expect(ctx.mailer.emailChanges).toStrictEqual([
      {
        to,
        name: ana.account.name,
        token: expect.any(String) as unknown,
        expiresAt,
      },
    ]);
    const change = await ctx.emailChanges.findByTokenHash(
      ctx.tokens.hash(ctx.mailer.emailChanges[0]?.token ?? ""),
    );
    expect(change?.toSnapshot()).toMatchObject({
      accountId: ana.accountId,
      newEmail: to,
      expiresAt,
    });
    expect((await ctx.accounts.findById(ana.accountId))?.email.value).toBe(
      ana.email,
    );
  });

  it("drops the pending change of an earlier request", async () => {
    const ana = await seedAccount(ctx);
    await useCase.execute(
      { newEmail: newEmail(), password: ana.password },
      ana.actor,
    );
    ctx.clock.advance(1_000);

    await useCase.execute(
      { newEmail: newEmail(), password: ana.password },
      ana.actor,
    );

    const [first, second] = await ctx.emailChanges.listByAccountId(
      ana.accountId,
    );
    expect(first?.isDeleted()).toBe(true);
    expect(second?.isPending(ctx.clock.now())).toBe(true);
  });

  it("throws InvalidCredentials for a wrong password", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(
        { newEmail: newEmail(), password: `${ana.password}-wrong` },
        ana.actor,
      ),
      IdentityError.InvalidCredentials,
      { email: ana.email },
    );
  });

  it("throws EmailChangeNeedsPassword for an account without a password", async () => {
    const ana = await seedAccount(ctx);
    ana.credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(ana.credential);
    await ctx.credentials.save(
      Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: ana.accountId,
          provider: AuthProvider.GITHUB,
          subject: faker.string.numeric(8),
        },
        ctx.clock.now(),
      ),
    );

    await expectAppError(
      useCase.execute(
        { newEmail: newEmail(), password: ana.password },
        ana.actor,
      ),
      IdentityError.EmailChangeNeedsPassword,
      { accountId: ana.accountId },
    );
  });

  it("throws AccountEmailTaken when another account uses the new e-mail", async () => {
    const ana = await seedAccount(ctx);
    const bruno = await seedAccount(ctx);

    await expectAppError(
      useCase.execute(
        { newEmail: bruno.email, password: ana.password },
        ana.actor,
      ),
      IdentityError.AccountEmailTaken,
      { email: bruno.email },
    );
  });

  it("throws CredentialEmailTaken when a credential uses the new e-mail", async () => {
    const ana = await seedAccount(ctx);
    const email = newEmail();
    await ctx.credentials.save(
      Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: faker.database.mongodbObjectId(),
          provider: AuthProvider.EMAIL,
          subject: email,
          providerEmail: email,
          passwordHash: await ctx.passwordHasher.hash(
            faker.internet.password(),
          ),
        },
        ctx.clock.now(),
      ),
    );

    await expectAppError(
      useCase.execute({ newEmail: email, password: ana.password }, ana.actor),
      IdentityError.CredentialEmailTaken,
      { email },
    );
  });
});
