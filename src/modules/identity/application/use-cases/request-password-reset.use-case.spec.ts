import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";
import { InMemoryCredentialRepository } from "../testing/in-memory-identity-repositories";
import { PASSWORD_RESET_TTL_MS } from "../token.policy";

import { RequestPasswordResetUseCase } from "./request-password-reset.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";

describe("RequestPasswordResetUseCase", () => {
  let ctx: IdentityContext;
  let useCase: RequestPasswordResetUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new RequestPasswordResetUseCase(ctx);
  });

  it("stores a reset token and e-mails it to the account", async () => {
    const ana = await seedAccount(ctx);
    const expiresAt = new Date(
      ctx.clock.now().getTime() + PASSWORD_RESET_TTL_MS,
    );

    await useCase.execute({ email: ana.email });

    expect(ctx.mailer.passwordResets).toEqual([
      {
        to: ana.email,
        name: ana.account.name,
        token: expect.any(String) as string,
        expiresAt,
      },
    ]);

    const [{ token }] = ctx.mailer.passwordResets;
    const reset = await ctx.passwordResets.findByTokenHash(
      ctx.tokens.hash(token),
    );
    expect(reset?.toSnapshot()).toMatchObject({
      accountId: ana.accountId,
      credentialId: ana.credential.id.value,
      expiresAt,
      consumedAt: null,
      deletedAt: null,
    });
  });

  it("invalidates the previous pending token when a new one is requested", async () => {
    const ana = await seedAccount(ctx);

    await useCase.execute({ email: ana.email });
    await useCase.execute({ email: ana.email });

    const [first, second] = ctx.mailer.passwordResets;
    const firstReset = await ctx.passwordResets.findByTokenHash(
      ctx.tokens.hash(first.token),
    );
    const secondReset = await ctx.passwordResets.findByTokenHash(
      ctx.tokens.hash(second.token),
    );
    expect(firstReset?.isDeleted()).toBe(true);
    expect(secondReset?.isPending(ctx.clock.now())).toBe(true);
    expect(
      await ctx.passwordResets.listByAccountId(ana.accountId),
    ).toHaveLength(2);
  });

  it("leaves an already consumed token untouched", async () => {
    const ana = await seedAccount(ctx);
    await useCase.execute({ email: ana.email });
    const [{ token }] = ctx.mailer.passwordResets;
    const consumed = await ctx.passwordResets.findByTokenHash(
      ctx.tokens.hash(token),
    );
    consumed!.consume(ctx.clock.now());
    await ctx.passwordResets.save(consumed!);

    await useCase.execute({ email: ana.email });

    const stored = await ctx.passwordResets.findByTokenHash(
      ctx.tokens.hash(token),
    );
    expect(stored?.isConsumed()).toBe(true);
    expect(stored?.isDeleted()).toBe(false);
  });

  describe("finishes silently without sending an e-mail", () => {
    it("when the e-mail is unknown", async () => {
      await useCase.execute({ email: faker.internet.email().toLowerCase() });

      expect(ctx.mailer.passwordResets).toEqual([]);
    });

    it("when the credential is deleted", async () => {
      const ana = await seedAccount(ctx);
      ana.credential.markAsDeleted(ctx.clock.now());
      await ctx.credentials.save(ana.credential);

      await useCase.execute({ email: ana.email });

      expect(ctx.mailer.passwordResets).toEqual([]);
      expect(await ctx.passwordResets.listByAccountId(ana.accountId)).toEqual(
        [],
      );
    });

    it("when the credential is not an e-mail credential", async () => {
      const email = faker.internet.email().toLowerCase();
      const google = Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: faker.database.mongodbObjectId(),
          provider: AuthProvider.GOOGLE,
          subject: faker.string.numeric(21),
          providerEmail: email,
        },
        ctx.clock.now(),
      );
      // The in-memory findByEmail only returns e-mail credentials, so stub it.
      const credentials = Object.assign(new InMemoryCredentialRepository(), {
        findByEmail: () => Promise.resolve(google),
      });
      useCase = new RequestPasswordResetUseCase({ ...ctx, credentials });

      await useCase.execute({ email });

      expect(ctx.mailer.passwordResets).toEqual([]);
    });

    it("when the account does not exist", async () => {
      const email = faker.internet.email().toLowerCase();
      const orphan = Credential.register(
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
      );
      await ctx.credentials.save(orphan);

      await useCase.execute({ email });

      expect(ctx.mailer.passwordResets).toEqual([]);
    });

    it("when the account is deleted", async () => {
      const ana = await seedAccount(ctx);
      ana.account.markAsDeleted(ctx.clock.now());
      await ctx.accounts.save(ana.account);

      await useCase.execute({ email: ana.email });

      expect(ctx.mailer.passwordResets).toEqual([]);
    });
  });
});
