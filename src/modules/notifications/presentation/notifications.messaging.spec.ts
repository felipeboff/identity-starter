import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { Dispatcher } from "@shared/presentation/dispatcher";
import { MessageConsumerAdapter } from "@shared/presentation/messaging/message-consumer-adapter";
import { SchemaParser } from "@shared/presentation/schema-parser";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeClock } from "@shared/testing/fake-clock";
import { InMemoryOutbox } from "@shared/testing/in-memory-outbox";
import { InMemoryTransactionRunner } from "@shared/testing/in-memory-transaction-runner";
import { beforeEach, describe, expect, it } from "vitest";

import { createNotificationsMessageConsumers } from "./notifications.messaging";

import { AccountRegisteredVia, IdentityEvent } from "@/identity/public";
import { NotificationsOutboxEffect } from "@/notifications/application/outbox/notifications-outbox-effect";
import { ScheduleEmailChangedNoticeUseCase } from "@/notifications/application/use-cases/schedule-email-changed-notice.use-case";
import { ScheduleWelcomeEmailUseCase } from "@/notifications/application/use-cases/schedule-welcome-email.use-case";

describe("notifications message consumers", () => {
  let outbox: InMemoryOutbox;
  let subscriptions: ReturnType<MessageConsumerAdapter["toSubscriptions"]>;

  beforeEach(() => {
    const transactions = new InMemoryTransactionRunner();
    outbox = new InMemoryOutbox({ transactions, clock: new FakeClock() });
    subscriptions = new MessageConsumerAdapter({
      dispatcher: new Dispatcher({ parser: new SchemaParser() }),
    }).toSubscriptions(
      createNotificationsMessageConsumers({
        scheduleWelcomeEmail: new ScheduleWelcomeEmailUseCase({
          transactions,
          outbox,
        }),
        scheduleEmailChangedNotice: new ScheduleEmailChangedNoticeUseCase({
          transactions,
          outbox,
        }),
      }),
    );
  });

  const subscriptionOf = (event: string) =>
    subscriptions.find((subscription) => subscription.event === event)!;

  const effects = () =>
    outbox.effects().map(({ type, payload }) => ({ type, payload }));

  it.each(Object.values(AccountRegisteredVia))(
    "schedules a welcome e-mail for every way an account registers (%s)",
    async (registeredVia) => {
      const payload = {
        accountId: faker.database.mongodbObjectId(),
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
        registeredVia,
      };
      const subscription = subscriptionOf(IdentityEvent.ACCOUNT_REGISTERED);

      await subscription.handler.handle({
        id: faker.database.mongodbObjectId(),
        payload,
      });

      expect(subscription.consumer).toBe(
        "notifications.schedule_welcome_email",
      );
      expect(effects()).toStrictEqual([
        {
          type: NotificationsOutboxEffect.WELCOME_EMAIL,
          payload: { to: payload.email, name: payload.name },
        },
      ]);
    },
  );

  it("refuses a welcome event whose e-mail is not an e-mail", async () => {
    await expectAppError(
      subscriptionOf(IdentityEvent.ACCOUNT_REGISTERED).handler.handle({
        id: faker.database.mongodbObjectId(),
        payload: {
          accountId: faker.database.mongodbObjectId(),
          email: faker.lorem.word(),
          name: faker.person.fullName(),
          registeredVia: AccountRegisteredVia.SIGN_UP,
        },
      }),
      SharedError.InputInvalid,
      { violations: [{ field: "email", reason: "format" }] },
    );

    expect(effects()).toStrictEqual([]);
  });

  it("schedules the e-mail changed notice to the previous e-mail from identity.email.changed", async () => {
    const payload = {
      accountId: faker.database.mongodbObjectId(),
      previousEmail: faker.internet.email().toLowerCase(),
      newEmail: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
    };
    const subscription = subscriptionOf(IdentityEvent.EMAIL_CHANGED);

    await subscription.handler.handle({
      id: faker.database.mongodbObjectId(),
      payload,
    });

    expect(subscription.consumer).toBe(
      "notifications.schedule_email_changed_notice",
    );
    expect(effects()).toStrictEqual([
      {
        type: NotificationsOutboxEffect.EMAIL_CHANGED_NOTICE,
        payload: {
          to: payload.previousEmail,
          name: payload.name,
          newEmail: payload.newEmail,
        },
      },
    ]);
  });
});
