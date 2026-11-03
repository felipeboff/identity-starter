import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { buildOutgoingEmail } from "@shared/testing/build-outgoing-email";
import { FakeLogger } from "@shared/testing/fake-logger";
import { describe, expect, it, vi } from "vitest";

import { LogMailSender } from "./log-mail-sender";
import { NotificationsLogEvent } from "./notifications.log-event";

describe("LogMailSender", () => {
  it("logs the e-mail instead of sending it", async () => {
    const logger = new FakeLogger();
    const fetch = vi.spyOn(globalThis, "fetch");
    const expiresAt = faker.date.future();
    const email = buildOutgoingEmail({ expiresAt });

    await new LogMailSender({ logger }).send(email);

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.INFO,
        event: NotificationsLogEvent.EmailLogged.name,
        fields: {
          template: email.template,
          to: email.to,
          link: email.link,
          expiresAt: expiresAt.toISOString(),
        },
      },
    ]);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("logs the e-mail instead of sending it, with no link and no expiry when it has none", async () => {
    const logger = new FakeLogger();
    const email = buildOutgoingEmail({ link: null, expiresAt: null });

    await new LogMailSender({ logger }).send(email);

    expect(logger.entries.map((entry) => entry.fields)).toStrictEqual([
      { template: email.template, to: email.to, link: null, expiresAt: null },
    ]);
  });
});
