import { faker } from "@faker-js/faker";
import { OutboxKind } from "@shared/application/ports/outbox";
import { FakeClock } from "@shared/testing/fake-clock";
import { InMemoryOutbox } from "@shared/testing/in-memory-outbox";
import { InMemoryTransactionRunner } from "@shared/testing/in-memory-transaction-runner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsOutboxEffect } from "../outbox/notifications-outbox-effect";

import { ScheduleWelcomeEmailUseCase } from "./schedule-welcome-email.use-case";

describe("ScheduleWelcomeEmailUseCase", () => {
  let transactions: InMemoryTransactionRunner;
  let outbox: InMemoryOutbox;
  let useCase: ScheduleWelcomeEmailUseCase;

  beforeEach(() => {
    transactions = new InMemoryTransactionRunner();
    outbox = new InMemoryOutbox({ transactions, clock: new FakeClock() });
    useCase = new ScheduleWelcomeEmailUseCase({ transactions, outbox });
  });

  const buildInput = () => ({
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
  });

  it("records the welcome e-mail effect with the account's e-mail and name, inside a transaction", async () => {
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
        type: NotificationsOutboxEffect.WELCOME_EMAIL,
        payload: { to: input.email, name: input.name },
      },
    ]);
  });

  it("records the welcome e-mail effect in the transaction already open, which drops it when it aborts", async () => {
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
