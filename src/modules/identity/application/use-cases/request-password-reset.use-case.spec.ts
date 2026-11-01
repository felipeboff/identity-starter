import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimitPolicy } from "../rate-limit.policy";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";
import { PASSWORD_RESET_TTL_MS } from "../token.policy";

import { RequestPasswordResetUseCase } from "./request-password-reset.use-case";

import { Account } from "@/identity/domain/account.entity";
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

  it("e-mails a reset link to an account that signs in only with OAuth", async () => {
    const accountId = faker.database.mongodbObjectId();
    const email = faker.internet.email().toLowerCase();
    const at = ctx.clock.now();
    const account = Account.register(
      {
        id: accountId,
        name: faker.person.fullName(),
        email,
        createdBy: accountId,
      },
      at,
    );
    await ctx.accounts.save(account);
    await ctx.credentials.save(
      Credential.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId,
          provider: AuthProvider.GITHUB,
          subject: faker.string.numeric(9),
        },
        at,
      ),
    );

    await useCase.execute({ email });

    expect(ctx.mailer.passwordResets).toEqual([
      expect.objectContaining({ to: email, name: account.name }),
    ]);
    expect(await ctx.passwordResets.listByAccountId(accountId)).toHaveLength(1);
  });

  describe("finishes silently without sending an e-mail", () => {
    it("when the e-mail is unknown", async () => {
      await useCase.execute({ email: faker.internet.email().toLowerCase() });

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

  it("writes nothing when the last write fails", async () => {
    const ana = await seedAccount(ctx);
    await useCase.execute({ email: ana.email });
    const [first] = ctx.mailer.passwordResets;
    const failure = new Error(faker.lorem.sentence());
    const save = ctx.passwordResets.save.bind(ctx.passwordResets);
    vi.spyOn(ctx.passwordResets, "save")
      .mockImplementationOnce(save)
      .mockRejectedValueOnce(failure);

    await expect(useCase.execute({ email: ana.email })).rejects.toBe(failure);

    const previous = await ctx.passwordResets.findByTokenHash(
      ctx.tokens.hash(first.token),
    );
    expect(previous?.isPending(ctx.clock.now())).toBe(true);
    expect(ctx.mailer.passwordResets).toStrictEqual([first]);
  });

  it("sends the e-mail after the transaction commits", async () => {
    const ana = await seedAccount(ctx);
    const send = ctx.mailer.sendPasswordReset.bind(ctx.mailer);
    const seen: { running: boolean; stored: boolean }[] = [];
    vi.spyOn(ctx.mailer, "sendPasswordReset").mockImplementation(
      async (email) => {
        seen.push({
          running: ctx.transactions.isRunning(),
          stored:
            (await ctx.passwordResets.findByTokenHash(
              ctx.tokens.hash(email.token),
            )) !== null,
        });
        return send(email);
      },
    );

    await useCase.execute({ email: ana.email });

    expect(seen).toStrictEqual([{ running: false, stored: true }]);
  });

  it("stops sending reset e-mails to one address past the limit, silently", async () => {
    const ana = await seedAccount(ctx);
    const limit = RateLimitPolicy.PASSWORD_RESET_REQUEST_PER_EMAIL.limit;
    for (let i = 0; i < limit; i++) {
      await useCase.execute({ email: ana.email });
    }

    await useCase.execute({ email: ana.email });

    expect(ctx.mailer.passwordResets).toHaveLength(limit);
  });
});
