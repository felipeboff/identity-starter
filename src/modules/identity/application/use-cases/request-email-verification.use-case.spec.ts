import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";
import { EMAIL_VERIFICATION_TTL_MS } from "../token.policy";

import { RequestEmailVerificationUseCase } from "./request-email-verification.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("RequestEmailVerificationUseCase", () => {
  let ctx: IdentityContext;
  let useCase: RequestEmailVerificationUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new RequestEmailVerificationUseCase(ctx);
  });

  it("stores a verification token and e-mails it to the account", async () => {
    const ana = await seedAccount(ctx);
    const expiresAt = new Date(
      ctx.clock.now().getTime() + EMAIL_VERIFICATION_TTL_MS,
    );

    await useCase.execute(ana.actor);

    expect(ctx.mailer.emailVerifications).toEqual([
      {
        to: ana.email,
        name: ana.account.name,
        token: expect.any(String) as string,
        expiresAt,
      },
    ]);

    const [{ token }] = ctx.mailer.emailVerifications;
    const verification = await ctx.emailVerifications.findByTokenHash(
      ctx.tokens.hash(token),
    );
    expect(verification?.toSnapshot()).toMatchObject({
      accountId: ana.accountId,
      expiresAt,
      consumedAt: null,
      deletedAt: null,
    });
  });

  it("invalidates pending tokens but keeps consumed ones", async () => {
    const ana = await seedAccount(ctx);
    await useCase.execute(ana.actor);
    const [first] = ctx.mailer.emailVerifications;
    const consumed = await ctx.emailVerifications.findByTokenHash(
      ctx.tokens.hash(first.token),
    );
    consumed!.consume(ctx.clock.now());
    await ctx.emailVerifications.save(consumed!);

    await useCase.execute(ana.actor);
    await useCase.execute(ana.actor);

    const [, second, third] = ctx.mailer.emailVerifications;
    const states = await Promise.all(
      [first, second, third].map(async ({ token }) => {
        const v = await ctx.emailVerifications.findByTokenHash(
          ctx.tokens.hash(token),
        );
        return { consumed: v?.isConsumed(), deleted: v?.isDeleted() };
      }),
    );
    expect(states).toEqual([
      { consumed: true, deleted: false },
      { consumed: false, deleted: true },
      { consumed: false, deleted: false },
    ]);
  });

  it("throws AccountEmailAlreadyVerified when the e-mail is already verified", async () => {
    const ana = await seedAccount(ctx);
    ana.account.markEmailAsVerified(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute(ana.actor),
      IdentityError.AccountEmailAlreadyVerified,
      { accountId: ana.accountId },
    );
    expect(ctx.mailer.emailVerifications).toEqual([]);
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    // An actor whose account is not stored.
    const ghost = {
      ...(await seedAccount(ctx)).actor,
      accountId: faker.database.mongodbObjectId(),
    };

    await expectAppError(
      useCase.execute(ghost),
      IdentityError.AccountNotFound,
      { accountId: ghost.accountId },
    );
  });

  it("writes nothing when the last write fails", async () => {
    const ana = await seedAccount(ctx);
    await useCase.execute(ana.actor);
    const [first] = ctx.mailer.emailVerifications;
    const failure = new Error(faker.lorem.sentence());
    const save = ctx.emailVerifications.save.bind(ctx.emailVerifications);
    vi.spyOn(ctx.emailVerifications, "save")
      .mockImplementationOnce(save)
      .mockRejectedValueOnce(failure);

    await expect(useCase.execute(ana.actor)).rejects.toBe(failure);

    const previous = await ctx.emailVerifications.findByTokenHash(
      ctx.tokens.hash(first.token),
    );
    expect(previous?.isPending(ctx.clock.now())).toBe(true);
    expect(ctx.mailer.emailVerifications).toStrictEqual([first]);
  });

  it("sends the e-mail after the transaction commits", async () => {
    const ana = await seedAccount(ctx);
    const send = ctx.mailer.sendEmailVerification.bind(ctx.mailer);
    const seen: { running: boolean; stored: boolean }[] = [];
    vi.spyOn(ctx.mailer, "sendEmailVerification").mockImplementation(
      async (email) => {
        seen.push({
          running: ctx.transactions.isRunning(),
          stored:
            (await ctx.emailVerifications.findByTokenHash(
              ctx.tokens.hash(email.token),
            )) !== null,
        });
        return send(email);
      },
    );

    await useCase.execute(ana.actor);

    expect(seen).toStrictEqual([{ running: false, stored: true }]);
  });
});
