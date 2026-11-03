import { faker } from "@faker-js/faker";
import { AppError } from "@shared/domain/errors/app-error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { describe, expect, it, vi } from "vitest";

import { FakeNotificationsMailer } from "../testing/fake-notifications-mailer";

import { SendEmailChangedNoticeUseCase } from "./send-email-changed-notice.use-case";

import { NotificationsError } from "@/notifications/domain/errors/notifications.error";

const buildNotice = () => ({
  to: faker.internet.email().toLowerCase(),
  name: faker.person.fullName(),
  newEmail: faker.internet.email().toLowerCase(),
});

describe("SendEmailChangedNoticeUseCase", () => {
  it("sends the e-mail changed notice through the mailer", async () => {
    const mailer = new FakeNotificationsMailer();
    const notice = buildNotice();

    await new SendEmailChangedNoticeUseCase({ mailer }).execute(notice);

    expect(mailer.emailChangedNotices).toStrictEqual([notice]);
    expect(mailer.welcomes).toStrictEqual([]);
  });

  it("fails when the mailer cannot send, so the effect is tried again", async () => {
    const mailer = new FakeNotificationsMailer();
    vi.spyOn(mailer, "sendEmailChanged").mockRejectedValueOnce(
      new AppError(NotificationsError.EmailDeliveryFailed),
    );

    await expectAppError(
      new SendEmailChangedNoticeUseCase({ mailer }).execute(buildNotice()),
      NotificationsError.EmailDeliveryFailed,
    );
  });
});
