import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityOutboxEffect } from "../outbox/identity-outbox-effect";
import {
  IdentityContext,
  createIdentityContext,
  recordedEmails,
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

  const verificationEmails = () =>
    recordedEmails(ctx, IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL);

  it("records the verification e-mail in the outbox instead of sending it", async () => {
    const ana = await seedAccount(ctx);
    const expiresAt = new Date(
      ctx.clock.now().getTime() + EMAIL_VERIFICATION_TTL_MS,
    );

    await useCase.execute(ana.actor);

    expect(ctx.outbox.effects()).toStrictEqual([
      expect.objectContaining({
        type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
        payload: {
          to: ana.email,
          name: ana.account.name,
          token: expect.any(String) as string,
          expiresAt,
        },
      }),
    ]);
    expect(ctx.mailer.emailVerifications).toStrictEqual([]);

    const [{ token }] = verificationEmails();
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
    const [first] = verificationEmails();
    const consumed = await ctx.emailVerifications.findByTokenHash(
      ctx.tokens.hash(first.token),
    );
    consumed!.consume(ctx.clock.now());
    await ctx.emailVerifications.save(consumed!);

    await useCase.execute(ana.actor);
    await useCase.execute(ana.actor);

    const [, second, third] = verificationEmails();
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
    expect(ctx.outbox.effects()).toStrictEqual([]);
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
    const [first] = verificationEmails();
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
    expect(verificationEmails()).toStrictEqual([first]);
  });

  it("records the e-mail inside the transaction that stores the verification", async () => {
    const ana = await seedAccount(ctx);
    const record = ctx.outbox.record.bind(ctx.outbox);
    const seen: { running: boolean; stored: boolean }[] = [];
    vi.spyOn(ctx.outbox, "record").mockImplementation(async (effect) => {
      const { token } = effect.payload as { token: string };
      seen.push({
        running: ctx.transactions.isRunning(),
        stored:
          (await ctx.emailVerifications.findByTokenHash(
            ctx.tokens.hash(token),
          )) !== null,
      });
      return record(effect);
    });

    await useCase.execute(ana.actor);

    expect(seen).toStrictEqual([{ running: true, stored: true }]);
  });
});
