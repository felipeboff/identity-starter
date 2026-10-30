import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("signs out every session and tells the old address", async () => {
    const { ana, newEmail, token } = await givenChange();
    const { session } = await seedSession(ctx, ana);

    await useCase.execute({ token });

    expect((await ctx.sessions.findById(session.id.value))?.revokedReason).toBe(
      SessionRevocationReason.EMAIL_CHANGED,
    );
    expect(ctx.mailer.emailChangedNotices).toStrictEqual([
      { to: ana.email, name: ana.account.name, newEmail },
    ]);
  });

  it("still changes the e-mail, and logs it, when the notice cannot be sent", async () => {
    const { ana, newEmail, token } = await givenChange();
    const error = new Error(faker.lorem.sentence());
    vi.spyOn(ctx.mailer, "sendEmailChanged").mockRejectedValueOnce(error);

    await useCase.execute({ token });

    expect((await ctx.accounts.findById(ana.accountId))?.email.value).toBe(
      newEmail,
    );
    expect(ctx.logger.entries).toStrictEqual([
      {
        level: LogLevel.WARN,
        event: IdentityUseCaseLogEvent.EmailChangedNoticeNotSent.name,
        fields: { accountId: ana.accountId, error },
      },
    ]);
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
