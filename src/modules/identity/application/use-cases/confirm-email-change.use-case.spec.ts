import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityEvent } from "../events/identity-event";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";
import { EMAIL_CHANGE_TTL_MS } from "../token.policy";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import { ConfirmEmailChangeUseCase } from "./confirm-email-change.use-case";
import { RequestEmailChangeUseCase } from "./request-email-change.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("ConfirmEmailChangeUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ConfirmEmailChangeUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ConfirmEmailChangeUseCase(ctx);
  });

  const givenChange = async () => {
    const ana = await seedAccount(ctx);
    const newEmail = faker.internet.email().toLowerCase();
    await new RequestEmailChangeUseCase(ctx).execute(
      { newEmail, password: ana.password },
      ana.actor,
    );
    const token = ctx.mailer.emailChanges.at(-1)?.token ?? "";
    return { ana, newEmail, token };
  };

  it("moves the account and its password credential to the new e-mail", async () => {
    const { ana, newEmail, token } = await givenChange();

    const output = await useCase.execute({ token });

    const now = ctx.clock.now();
    expect(output.account).toMatchObject({
      id: ana.accountId,
      email: newEmail,
      emailVerifiedAt: now,
    });
    expect((await ctx.credentials.findByEmail(newEmail))?.id.value).toBe(
      ana.credential.id.value,
    );
    expect(await ctx.credentials.findByEmail(ana.email)).toBeNull();
  });

  it("signs out every session", async () => {
    const { ana, token } = await givenChange();
    const { session } = await seedSession(ctx, ana);

    await useCase.execute({ token });

    expect((await ctx.sessions.findById(session.id.value))?.revokedReason).toBe(
      SessionRevocationReason.EMAIL_CHANGED,
    );
  });

  it("publishes identity.email.changed in the change's transaction", async () => {
    const { ana, newEmail, token } = await givenChange();
    const publish = ctx.outbox.publish.bind(ctx.outbox);
    const seen: { running: boolean; changed: boolean }[] = [];
    vi.spyOn(ctx.outbox, "publish").mockImplementation(async (message) => {
      seen.push({
        running: ctx.transactions.isRunning(),
        changed: (await ctx.accounts.findByEmail(newEmail)) !== null,
      });
      return publish(message);
    });

    await useCase.execute({ token });

    expect(seen).toStrictEqual([{ running: true, changed: true }]);
    expect(
      ctx.outbox.events().map(({ type, payload }) => ({ type, payload })),
    ).toStrictEqual([
      {
        type: IdentityEvent.EMAIL_CHANGED,
        payload: {
          accountId: ana.accountId,
          previousEmail: ana.email,
          newEmail,
          name: ana.account.name,
        },
      },
    ]);
  });

  it("does not send the e-mail changed notice itself", async () => {
    const { token } = await givenChange();
    const sentBefore = {
      passwordResets: [...ctx.mailer.passwordResets],
      emailVerifications: [...ctx.mailer.emailVerifications],
      invitations: [...ctx.mailer.invitations],
      emailChanges: [...ctx.mailer.emailChanges],
    };

    await useCase.execute({ token });

    expect({
      passwordResets: ctx.mailer.passwordResets,
      emailVerifications: ctx.mailer.emailVerifications,
      invitations: ctx.mailer.invitations,
      emailChanges: ctx.mailer.emailChanges,
    }).toStrictEqual(sentBefore);
  });

  it("keeps no identity.email.changed when the change fails after publishing it", async () => {
    const { ana, token } = await givenChange();
    await seedSession(ctx, ana);
    const failure = new Error(faker.lorem.sentence());
    const publish = vi.spyOn(ctx.outbox, "publish");
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(useCase.execute({ token })).rejects.toBe(failure);

    expect(publish).toHaveBeenCalledOnce();
    expect(ctx.outbox.events()).toStrictEqual([]);
  });

  it("logs identity.email_changed", async () => {
    const { ana, newEmail, token } = await givenChange();

    await useCase.execute({ token });

    expect(ctx.logger.entries).toContainEqual({
      level: LogLevel.INFO,
      event: IdentityUseCaseLogEvent.EmailChanged.name,
      fields: { accountId: ana.accountId, oldEmail: ana.email, newEmail },
    });
  });

  it("throws InvalidEmailChangeToken for an unknown token", async () => {
    await expectAppError(
      useCase.execute({ token: faker.string.alphanumeric(43) }),
      IdentityError.InvalidEmailChangeToken,
    );
  });

  it("throws EmailChangeAlreadyConsumed the second time", async () => {
    const { token } = await givenChange();
    await useCase.execute({ token });

    await expectAppError(
      useCase.execute({ token }),
      IdentityError.EmailChangeAlreadyConsumed,
    );
  });

  it("throws EmailChangeExpired once the link is over", async () => {
    const { token } = await givenChange();
    ctx.clock.advance(EMAIL_CHANGE_TTL_MS);

    await expectAppError(
      useCase.execute({ token }),
      IdentityError.EmailChangeExpired,
    );
  });

  it("throws AccountEmailTaken when the new e-mail got an account meanwhile", async () => {
    const { newEmail, token } = await givenChange();
    await seedAccount(ctx, { email: newEmail });

    await expectAppError(
      useCase.execute({ token }),
      IdentityError.AccountEmailTaken,
      { email: newEmail },
    );
  });

  it("throws EmailChangeNeedsPassword when the password credential was removed", async () => {
    const { ana, token } = await givenChange();
    ana.credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(ana.credential);

    await expectAppError(
      useCase.execute({ token }),
      IdentityError.EmailChangeNeedsPassword,
      { accountId: ana.accountId },
    );
  });

  it("writes nothing when the last write fails", async () => {
    const { ana, token } = await givenChange();
    await seedSession(ctx, ana);
    const failure = new Error(faker.lorem.sentence());
    vi.spyOn(ctx.sessions, "save").mockRejectedValueOnce(failure);

    await expect(useCase.execute({ token })).rejects.toBe(failure);

    expect((await ctx.accounts.findById(ana.accountId))?.email.value).toBe(
      ana.email,
    );
  });
});
