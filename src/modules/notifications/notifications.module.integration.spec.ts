import { faker } from "@faker-js/faker";
import { OutboxKind } from "@shared/application/ports/outbox";
import { MessageRunner } from "@shared/application/services/message-runner";
import {
  OutboxEffectRunner,
  OutboxRunOutcome,
} from "@shared/application/services/outbox-effect-runner";
import { AppError } from "@shared/domain/errors/app-error";
import { MongoInbox } from "@shared/infrastructure/mongo/mongo-inbox";
import { MongoOutbox } from "@shared/infrastructure/mongo/mongo-outbox";
import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import type { OutboxDocument } from "@shared/infrastructure/mongo/outbox.schema";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { MessageConsumerAdapter } from "@shared/presentation/messaging/message-consumer-adapter";
import { OutboxConsumerAdapter } from "@shared/presentation/outbox/outbox-consumer-adapter";
import { SchemaParser } from "@shared/presentation/schema-parser";
import { FakeClock } from "@shared/testing/fake-clock";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationsOutboxEffect } from "./application/outbox/notifications-outbox-effect";
import { NotificationsError } from "./domain/errors/notifications.error";
import { LogMailSender } from "./infrastructure/log-mail-sender";
import { MailerSendMailSender } from "./infrastructure/mailersend-mail-sender";
import {
  type NotificationsMailerSettings,
  type NotificationsSettings,
  createNotificationsModule,
} from "./notifications.module";

import { AccountRegisteredVia, IdentityEvent } from "@/identity/public";

const mongo = useMemoryMongo();

const buildSettings = (
  kind: NotificationsMailerSettings["kind"] = "log",
): NotificationsSettings => ({
  appUrl: new URL(faker.internet.url()),
  productName: faker.company.name(),
  externalCallTimeoutMs: 1_000,
  mailer: {
    kind,
    apiKey: faker.string.alphanumeric(40),
    from: { email: faker.internet.email(), name: faker.company.name() },
  },
});

const create = async (settings = buildSettings()) => {
  const connection = mongo.connection();
  const logger = new FakeLogger();
  const clock = new FakeClock(new Date());
  const outbox = new MongoOutbox({ connection, clock });
  await outbox.ready();
  const inbox = new MongoInbox(connection);
  await inbox.ready();
  await connection.collection("outbox").deleteMany({});
  await connection.collection("inbox").deleteMany({});
  const transactions = new MongoTransactionRunner(connection);
  const notifications = createNotificationsModule(settings, {
    logger,
    outbox,
    transactions,
  });
  const dispatcher = new Dispatcher({ parser: new SchemaParser() });
  const subscriptions = new MessageConsumerAdapter({
    dispatcher,
  }).toSubscriptions(notifications.messageConsumers);
  const messages = new MessageRunner({ inbox, transactions, clock, logger });
  const effects = new OutboxEffectRunner({
    store: outbox,
    handlers: new OutboxConsumerAdapter({ dispatcher }).toHandlers(
      notifications.outboxConsumers,
    ),
    clock,
    logger,
  });

  const deliver = (
    event: string,
    payload: Record<string, unknown>,
    id = faker.database.mongodbObjectId(),
  ) =>
    messages.run({
      subscription: subscriptions.find(
        (subscription) => subscription.event === event,
      )!,
      id,
      payload,
      attempt: 1,
    });

  const runNextEffect = async (attempt = 1) => {
    const now = clock.now();
    const effect = await outbox.reserve({
      now,
      lockedUntil: new Date(now.getTime() + 30_000),
    });
    if (!effect) throw new Error("No effect is due");
    return effects.run({ ...effect, attempt, maxAttempts: 8 });
  };

  const sent = vi.spyOn(notifications.mailSender, "send");
  return {
    notifications,
    settings,
    outbox,
    transactions,
    clock,
    deliver,
    runNextEffect,
    sent,
  };
};

const outboxEntries = () =>
  mongo.connection().collection<OutboxDocument>("outbox");

const buildRegistered = () => ({
  accountId: faker.database.mongodbObjectId(),
  email: faker.internet.email().toLowerCase(),
  name: faker.person.fullName(),
  registeredVia: faker.helpers.arrayElement(
    Object.values(AccountRegisteredVia),
  ),
});

describe("createNotificationsModule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["log", LogMailSender],
    ["mailersend", MailerSendMailSender],
  ] as const)(
    "declares the notifications consumers and its MailSender (%s)",
    async (kind, sender) => {
      const { notifications } = await create(buildSettings(kind));

      expect(
        notifications.messageConsumers.map((consumer) => [
          consumer.event,
          consumer.handler.name,
        ]),
      ).toStrictEqual([
        [
          IdentityEvent.ACCOUNT_REGISTERED,
          "notifications.schedule_welcome_email",
        ],
        [
          IdentityEvent.EMAIL_CHANGED,
          "notifications.schedule_email_changed_notice",
        ],
      ]);
      expect(
        notifications.outboxConsumers.map((consumer) => [
          consumer.type,
          consumer.handler.name,
        ]),
      ).toStrictEqual([
        [
          NotificationsOutboxEffect.WELCOME_EMAIL,
          "notifications.send_welcome_email",
        ],
        [
          NotificationsOutboxEffect.EMAIL_CHANGED_NOTICE,
          "notifications.send_email_changed_notice",
        ],
      ]);
      expect(notifications.mailSender).toBeInstanceOf(sender);
    },
  );

  it("records one welcome e-mail when the event arrives twice, in the inbox's transaction", async () => {
    const { deliver, outbox, transactions } = await create();
    const publish = outbox.publish.bind(outbox);
    const running: boolean[] = [];
    vi.spyOn(outbox, "publish").mockImplementation((message) => {
      running.push(transactions.isRunning());
      return publish(message);
    });
    const event = buildRegistered();
    const id = faker.database.mongodbObjectId();

    const outcomes = [
      await deliver(IdentityEvent.ACCOUNT_REGISTERED, event, id),
      await deliver(IdentityEvent.ACCOUNT_REGISTERED, event, id),
    ];

    expect(outcomes).toStrictEqual(["handled", "duplicate"]);
    expect(running).toStrictEqual([true]);
    expect(
      (await outboxEntries().find().toArray()).map(
        ({ kind, type, payload }) => ({ kind, type, payload }),
      ),
    ).toStrictEqual([
      {
        kind: OutboxKind.EFFECT,
        type: NotificationsOutboxEffect.WELCOME_EMAIL,
        payload: { to: event.email, name: event.name },
      },
    ]);
    expect(
      await mongo
        .connection()
        .collection("inbox")
        .countDocuments({ consumer: "notifications.schedule_welcome_email" }),
    ).toBe(1);
  });

  it("sends the welcome e-mail when its effect runs", async () => {
    const { deliver, runNextEffect, sent, settings } = await create();
    const event = buildRegistered();
    await deliver(IdentityEvent.ACCOUNT_REGISTERED, event);

    const result = await runNextEffect();

    const link = settings.appUrl.href;
    expect(result).toStrictEqual({ outcome: OutboxRunOutcome.PROCESSED });
    expect(sent.mock.calls).toStrictEqual([
      [
        {
          template: "welcome",
          to: event.email,
          name: event.name,
          subject: `Boas-vindas ao ${settings.productName}`,
          text: [
            `Olá, ${event.name}.`,
            `Sua conta no ${settings.productName} foi criada. Para entrar, acesse: ${link}`,
            "Se você não criou esta conta, fale com o suporte.",
          ].join("\n\n"),
          link,
          expiresAt: null,
          layout: {
            category: "Sua conta",
            title: `Boas-vindas ao ${settings.productName}`,
            paragraphs: [
              `Olá, ${event.name}.`,
              `Sua conta no ${settings.productName} foi criada.`,
            ],
            action: "Entrar",
            validity: null,
            alert: null,
            footnote: "Se você não criou esta conta, fale com o suporte.",
          },
        },
      ],
    ]);
  });

  it("leaves the welcome e-mail for the next attempt when sending fails", async () => {
    const { deliver, runNextEffect, sent, clock } = await create();
    sent.mockRejectedValueOnce(
      new AppError(NotificationsError.EmailDeliveryFailed),
    );
    const event = buildRegistered();
    await deliver(IdentityEvent.ACCOUNT_REGISTERED, event);
    const [pending] = await outboxEntries().find().toArray();

    const first = await runNextEffect(1);
    const afterFailure = await outboxEntries().findOne({ _id: pending._id });
    clock.advance(30_000);
    const second = await runNextEffect(2);

    expect(first).toMatchObject({ outcome: OutboxRunOutcome.RETRY });
    expect(afterFailure).toMatchObject({
      payload: { to: event.email, name: event.name },
      processedAt: null,
      failedAt: null,
    });
    expect(second).toStrictEqual({ outcome: OutboxRunOutcome.PROCESSED });
    expect(sent).toHaveBeenCalledTimes(2);
    expect(await outboxEntries().findOne({ _id: pending._id })).toMatchObject({
      processedAt: clock.now(),
      payload: null,
    });
  });

  it("sends the e-mail changed notice when its effect runs", async () => {
    const { deliver, runNextEffect, sent } = await create();
    const event = {
      accountId: faker.database.mongodbObjectId(),
      previousEmail: faker.internet.email().toLowerCase(),
      newEmail: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
    };
    await deliver(IdentityEvent.EMAIL_CHANGED, event);

    const result = await runNextEffect();

    expect(result).toStrictEqual({ outcome: OutboxRunOutcome.PROCESSED });
    expect(sent.mock.calls).toStrictEqual([
      [
        {
          template: "email_changed",
          to: event.previousEmail,
          name: event.name,
          subject: "Seu e-mail foi alterado",
          text: [
            `Olá, ${event.name}.`,
            `O e-mail da sua conta foi alterado para ${event.newEmail}.`,
            "Se não foi você, fale com o suporte imediatamente.",
          ].join("\n\n"),
          link: null,
          expiresAt: null,
          layout: {
            category: "Segurança",
            title: "Seu e-mail foi alterado",
            paragraphs: [
              `Olá, ${event.name}.`,
              `O e-mail da sua conta foi alterado para ${event.newEmail}.`,
            ],
            action: null,
            validity: null,
            alert: "Se não foi você, fale com o suporte imediatamente.",
            footnote:
              "Este aviso vai para o endereço antigo, para que você saiba de qualquer troca na sua conta.",
          },
        },
      ],
    ]);
  });
});
