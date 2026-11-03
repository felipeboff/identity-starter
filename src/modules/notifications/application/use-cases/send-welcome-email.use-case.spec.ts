import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { describe, expect, it, vi } from "vitest";

import { FakeNotificationsMailer } from "../testing/fake-notifications-mailer";

import { SendWelcomeEmailUseCase } from "./send-welcome-email.use-case";

import { NotificationsError } from "@/notifications/domain/errors/notifications.error";

const buildEmail = () => ({
  to: faker.internet.email().toLowerCase(),
  name: faker.person.fullName(),
});

describe("SendWelcomeEmailUseCase", () => {
  it("sends the welcome e-mail through the mailer", async () => {
    const mailer = new FakeNotificationsMailer();
    const email = buildEmail();

    await new SendWelcomeEmailUseCase({ mailer }).execute(email);

    expect(mailer.welcomes).toStrictEqual([email]);
    expect(mailer.emailChangedNotices).toStrictEqual([]);
  });

  it("fails when the mailer cannot send, so the effect is tried again", async () => {
    const mailer = new FakeNotificationsMailer();
    vi.spyOn(mailer, "sendWelcome").mockRejectedValueOnce(
      new AppError(NotificationsError.EmailDeliveryFailed),
    );

    await expectAppError(
      new SendWelcomeEmailUseCase({ mailer }).execute(buildEmail()),
      NotificationsError.EmailDeliveryFailed,
    );
  });
});
