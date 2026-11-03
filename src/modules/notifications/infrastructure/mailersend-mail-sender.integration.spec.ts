import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { FetchHttpClient } from "@shared/infrastructure/http/fetch-http-client";
import { buildOutgoingEmail } from "@shared/testing/build-outgoing-email";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeLogger } from "@shared/testing/fake-logger";
import { describe, expect, it, vi } from "vitest";

import { EmailHtmlRenderer } from "./email-html-renderer";
import {
  MAILERSEND_EMAIL_URL,
  MailerSendMailSender,
} from "./mailersend-mail-sender";
import { NotificationsLogEvent } from "./notifications.log-event";

import { NotificationsError } from "@/notifications/domain/errors/notifications.error";

type SentRequest = Readonly<{
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}>;

const create = (fetch: typeof globalThis.fetch, timeoutMs = 1_000) => {
  const logger = new FakeLogger();
  const apiKey = `mlsn.${faker.string.alphanumeric(64)}`;
  const from = { email: faker.internet.email(), name: faker.company.name() };
  const renderer = new EmailHtmlRenderer({ productName: from.name });
  const sender = new MailerSendMailSender({
    http: new FetchHttpClient({ timeoutMs, logger: new FakeLogger(), fetch }),
    renderer,
    logger,
    apiKey,
    from,
  });
  return { sender, renderer, logger, apiKey, from };
};

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

describe("MailerSendMailSender", () => {
  it("posts the e-mail to MailerSend with the key, the sender, the text and the HTML", async () => {
    const { fetch, sent } = respondWith(202);
    const { sender, renderer, logger, apiKey, from } = create(fetch);
    const email = buildOutgoingEmail();

    await sender.send(email);

    expect(sent).toStrictEqual([
      {
        url: MAILERSEND_EMAIL_URL,
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: {
          from,
          to: [{ email: email.to, name: email.name }],
          subject: email.subject,
          text: email.text,
          html: renderer.render(email),
        },
      },
    ]);
    expect(logger.entries).toStrictEqual([]);
  });

  it("logs notifications.email_delivery_failed with the status and rejects when MailerSend does not accept the e-mail", async () => {
    const status = faker.helpers.arrayElement([200, 401, 422, 429, 500]);
    const { sender, logger } = create(
      respondWith(status, JSON.stringify({ message: faker.lorem.sentence() }))
        .fetch,
    );
    const email = buildOutgoingEmail();

    await expectAppError(
      sender.send(email),
      NotificationsError.EmailDeliveryFailed,
    );

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: NotificationsLogEvent.EmailDeliveryFailed.name,
        fields: {
          template: email.template,
          failure: "unexpected_status",
          status,
        },
      },
    ]);
  });

  it("logs notifications.email_delivery_failed with the network failure and rejects when MailerSend cannot be reached", async () => {
    const { sender, logger } = create(
      vi.fn<typeof fetch>(() =>
        Promise.reject(new TypeError(faker.lorem.sentence())),
      ),
    );
    const email = buildOutgoingEmail();

    await expectAppError(
      sender.send(email),
      NotificationsError.EmailDeliveryFailed,
    );

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: NotificationsLogEvent.EmailDeliveryFailed.name,
        fields: { template: email.template, failure: "network" },
      },
    ]);
  });

  it("logs notifications.email_delivery_failed with the timeout and rejects when MailerSend does not answer in time", async () => {
    const { sender, logger } = create(
      vi.fn<typeof fetch>(
        (input) =>
          new Promise((_resolve, reject) => {
            const { signal } = input as Request;
            signal.addEventListener("abort", () => {
              reject(signal.reason as Error);
            });
          }),
      ),
      50,
    );
    const email = buildOutgoingEmail();

    await expectAppError(
      sender.send(email),
      NotificationsError.EmailDeliveryFailed,
    );

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: NotificationsLogEvent.EmailDeliveryFailed.name,
        fields: { template: email.template, failure: "timeout" },
      },
    ]);
  });
});
