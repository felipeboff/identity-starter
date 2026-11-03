import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { beforeEach, describe, expect, it } from "vitest";

import { IdentityOutboxEffect } from "../outbox/identity-outbox-effect";
import {
  IdentityContext,
  createIdentityContext,
} from "../testing/identity-context";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import { SendEmailVerificationEmailUseCase } from "./send-email-verification-email.use-case";

const nothingSent = {
  passwordResets: [],
  emailVerifications: [],
  invitations: [],
  emailChanges: [],
};

describe("SendEmailVerificationEmailUseCase", () => {
  let ctx: IdentityContext;
  let useCase: SendEmailVerificationEmailUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new SendEmailVerificationEmailUseCase(ctx);
  });

  const buildEmail = (
    expiresAt = faker.date.soon({ refDate: ctx.clock.now() }),
  ) => ({
    to: faker.internet.email(),
    name: faker.person.fullName(),
    token: faker.string.alphanumeric(32),
    expiresAt,
  });

  const sent = () => ({
    passwordResets: ctx.mailer.passwordResets,
    emailVerifications: ctx.mailer.emailVerifications,
    invitations: ctx.mailer.invitations,
    emailChanges: ctx.mailer.emailChanges,
  });

  it("sends the verification e-mail with the recorded fields", async () => {
    const email = buildEmail();

    await useCase.execute(email);

    expect(sent()).toStrictEqual({
      ...nothingSent,
      emailVerifications: [email],
    });
  });

  it.each([
    ["at", 0],
    ["after", faker.number.int({ min: 1, max: 86_400_000 })],
  ])(
    "skips an e-mail whose token expired before delivery (%s expiry)",
    async (_moment, pastMs) => {
      const expiresAt = ctx.clock.now();
      ctx.clock.advance(pastMs);

      await useCase.execute(buildEmail(expiresAt));

      expect(ctx.mailer.emailVerifications).toStrictEqual([]);
      expect(ctx.logger.entries).toStrictEqual([
        {
          level: LogLevel.INFO,
          event: IdentityUseCaseLogEvent.EmailExpiredBeforeDelivery.name,
          fields: { type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL },
        },
      ]);
    },
  );

  it("still sends an e-mail 1 ms before its token expires", async () => {
    const email = buildEmail(new Date(ctx.clock.now().getTime() + 1));

    await useCase.execute(email);

    expect(ctx.mailer.emailVerifications).toStrictEqual([email]);
    expect(ctx.logger.entries).toStrictEqual([]);
  });
});
