import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { FetchHttpClient } from "@shared/infrastructure/http/fetch-http-client";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeLogger } from "@shared/testing/fake-logger";
import { describe, expect, it, vi } from "vitest";

import { TokenEmail } from "../application/ports/identity-mailer";

import {
  IdentityEmailComposer,
  IdentityEmailTemplate,
} from "./identity-email-composer";
import { IdentityLogEvent } from "./identity.log-event";
import {
  MAILERSEND_EMAIL_URL,
  MailerSendIdentityMailer,
} from "./mailersend-identity-mailer";

import { IdentityError } from "@/identity/domain/errors/identity.error";

const buildTokenEmail = (): TokenEmail => ({
  to: faker.internet.email(),
  name: faker.person.fullName(),
  token: faker.string.alphanumeric(43),
  expiresAt: faker.date.future(),
});

const create = (fetch: typeof globalThis.fetch) => {
  const logger = new FakeLogger();
  const composer = new IdentityEmailComposer({
    appUrl: new URL(`https://${faker.internet.domainName()}`),
  });
  const apiKey = `mlsn.${faker.string.alphanumeric(64)}`;
  const from = { email: faker.internet.email(), name: faker.company.name() };
  const mailer = new MailerSendIdentityMailer({
    http: new FetchHttpClient({
      timeoutMs: 1_000,
      logger: new FakeLogger(),
      fetch,
    }),
    composer,
    logger,
    apiKey,
    from,
  });
  return { mailer, logger, composer, apiKey, from };
};

type SentRequest = Readonly<{
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}>;

const respondWith = (status: number, body = "") => {
  const sent: SentRequest[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const request = input as Request;
    sent.push({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body: JSON.parse(await request.text()),
    });
    return new Response(body, { status });
  });
  return { fetch, sent };
};

describe("MailerSendIdentityMailer", () => {
  it("sends the password reset e-mail through the MailerSend API", async () => {
    const { fetch, sent } = respondWith(202);
    const { mailer, composer, apiKey, from } = create(fetch);
    const email = buildTokenEmail();
    const composed = composer.passwordReset(email);

    await mailer.sendPasswordReset(email);

    expect(sent[0]).toMatchObject({
      url: MAILERSEND_EMAIL_URL,
      method: "POST",
    });
    expect(sent[0]?.headers).toStrictEqual({
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    });
    expect(sent[0]?.body).toStrictEqual({
      from,
      to: [{ email: email.to, name: email.name }],
      subject: composed.subject,
      text: composed.text,
    });
  });

  it("sends the e-mail verification through the MailerSend API", async () => {
    const { fetch, sent } = respondWith(202);
    const { mailer, composer } = create(fetch);
    const email = buildTokenEmail();
    const composed = composer.emailVerification(email);

    await mailer.sendEmailVerification(email);

    expect(sent[0]?.body).toMatchObject({
      subject: composed.subject,
      text: composed.text,
    });
  });

  it("fails and logs the status when MailerSend does not accept the e-mail", async () => {
    const status = faker.helpers.arrayElement([200, 401, 422, 429, 500]);
    const { mailer, logger } = create(
      respondWith(status, JSON.stringify({ message: faker.lorem.sentence() }))
        .fetch,
    );

    await expectAppError(
      mailer.sendPasswordReset(buildTokenEmail()),
      IdentityError.EmailDeliveryFailed,
    );

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: IdentityLogEvent.EmailDeliveryFailed.name,
        fields: {
          template: IdentityEmailTemplate.PASSWORD_RESET,
          failure: "unexpected_status",
          status,
        },
      },
    ]);
  });

  it("fails and logs the reason when MailerSend cannot be reached", async () => {
    const { mailer, logger } = create(
      vi.fn<typeof fetch>(() =>
        Promise.reject(new TypeError(faker.lorem.sentence())),
      ),
    );

    await expectAppError(
      mailer.sendEmailVerification(buildTokenEmail()),
      IdentityError.EmailDeliveryFailed,
    );

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: IdentityLogEvent.EmailDeliveryFailed.name,
        fields: {
          template: IdentityEmailTemplate.EMAIL_VERIFICATION,
          failure: "network",
        },
      },
    ]);
  });

  it("sends invitations and e-mail changes through the MailerSend API", async () => {
    const { fetch, sent } = respondWith(202);
    const { mailer, composer } = create(fetch);
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

    const subjects = sent.map(
      (request) => (request.body as { subject: string }).subject,
    );
    expect(subjects).toStrictEqual([
      composer.invitation(invitation).subject,
      composer.emailChange(email).subject,
      composer.emailChanged(notice).subject,
    ]);
  });
});
