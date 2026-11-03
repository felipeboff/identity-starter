import { faker } from "@faker-js/faker";
import { OutboxKind } from "@shared/application/ports/outbox";
import { FakeClock } from "@shared/testing/fake-clock";
import { InMemoryOutbox } from "@shared/testing/in-memory-outbox";
import { InMemoryTransactionRunner } from "@shared/testing/in-memory-transaction-runner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsOutboxEffect } from "../outbox/notifications-outbox-effect";

import { ScheduleEmailChangedNoticeUseCase } from "./schedule-email-changed-notice.use-case";

describe("ScheduleEmailChangedNoticeUseCase", () => {
  let transactions: InMemoryTransactionRunner;
  let outbox: InMemoryOutbox;
  let useCase: ScheduleEmailChangedNoticeUseCase;

  beforeEach(() => {
    transactions = new InMemoryTransactionRunner();
    outbox = new InMemoryOutbox({ transactions, clock: new FakeClock() });
    useCase = new ScheduleEmailChangedNoticeUseCase({ transactions, outbox });
  });

  const buildInput = () => ({
    previousEmail: faker.internet.email().toLowerCase(),
    newEmail: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
  });

  it("records the e-mail changed notice effect for the previous e-mail, inside a transaction", async () => {
    const input = buildInput();
    const publish = outbox.publish.bind(outbox);
    const running: boolean[] = [];
    vi.spyOn(outbox, "publish").mockImplementation((message) => {
      running.push(transactions.isRunning());
      return publish(message);
    });

    await useCase.execute(input);

    expect(running).toStrictEqual([true]);
    expect(
      outbox.entries().map(({ kind, type, payload }) => ({
        kind,
        type,
        payload,
      })),
    ).toStrictEqual([
      {
        kind: OutboxKind.EFFECT,
        type: NotificationsOutboxEffect.EMAIL_CHANGED_NOTICE,
        payload: {
          to: input.previousEmail,
          name: input.name,
          newEmail: input.newEmail,
        },
      },
    ]);
  });

  it("records the e-mail changed notice effect in the transaction already open, which drops it when it aborts", async () => {
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await useCase.execute(buildInput());
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(outbox.entries()).toStrictEqual([]);
  });
});
