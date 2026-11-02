import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { FakeLogger } from "@shared/testing/fake-logger";
import { describe, expect, it } from "vitest";

import { TokenEmail } from "../application/ports/identity-mailer";

import {
  IdentityEmailComposer,
  IdentityEmailTemplate,
} from "./identity-email-composer";
import { IdentityLogEvent } from "./identity.log-event";
import { LogIdentityMailer } from "./log-identity-mailer";

const buildTokenEmail = (): TokenEmail => ({
  to: faker.internet.email(),
  name: faker.person.fullName(),
  token: faker.string.alphanumeric(43),
  expiresAt: faker.date.future(),
});

const create = () => {
  const logger = new FakeLogger();
  const composer = new IdentityEmailComposer({
    appUrl: new URL(`https://${faker.internet.domainName()}`),
    productName: faker.company.name(),
  });
  return {
    mailer: new LogIdentityMailer({ composer, logger }),
    logger,
    composer,
  };
};

describe("LogIdentityMailer", () => {
  it("logs the password reset link instead of sending it", async () => {
    const { mailer, logger, composer } = create();
    const email = buildTokenEmail();

    await mailer.sendPasswordReset(email);

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.INFO,
        event: IdentityLogEvent.EmailLogged.name,
        fields: {
          template: IdentityEmailTemplate.PASSWORD_RESET,
          to: email.to,
          link: composer.passwordReset(email).link,
          expiresAt: email.expiresAt.toISOString(),
        },
      },
    ]);
  });

  it("logs the e-mail verification link instead of sending it", async () => {
    const { mailer, logger, composer } = create();
    const email = buildTokenEmail();

    await mailer.sendEmailVerification(email);

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.INFO,
        event: IdentityLogEvent.EmailLogged.name,
        fields: {
          template: IdentityEmailTemplate.EMAIL_VERIFICATION,
          to: email.to,
          link: composer.emailVerification(email).link,
          expiresAt: email.expiresAt.toISOString(),
        },
      },
    ]);
  });

  it("logs invitations and e-mail changes, and the notice without a link", async () => {
    const { mailer, logger, composer } = create();
    const email = buildTokenEmail();
    const invitation = {
      to: email.to,
      inviterName: faker.person.fullName(),
      token: email.token,
      expiresAt: email.expiresAt,
    };
    const notice = {
      to: email.to,
      name: email.name,
      newEmail: faker.internet.email(),
    };

    await mailer.sendInvitation(invitation);
    await mailer.sendEmailChange(email);
    await mailer.sendEmailChanged(notice);

    expect(logger.entries.map((entry) => entry.fields)).toStrictEqual([
      {
        template: IdentityEmailTemplate.INVITATION,
        to: email.to,
        link: composer.invitation(invitation).link,
        expiresAt: email.expiresAt.toISOString(),
      },
      {
        template: IdentityEmailTemplate.EMAIL_CHANGE,
        to: email.to,
        link: composer.emailChange(email).link,
        expiresAt: email.expiresAt.toISOString(),
      },
      {
        template: IdentityEmailTemplate.EMAIL_CHANGED,
        to: email.to,
        link: null,
        expiresAt: null,
      },
    ]);
  });
});
