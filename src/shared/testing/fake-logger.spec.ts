import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { defineLogEvent } from "../application/logging/log-event";
import type { LogLevel } from "../application/ports/logger";

import { FakeLogger } from "./fake-logger";

const AccountSeen = defineLogEvent<{ accountId: string }>(
  `${faker.lorem.word()}.${faker.lorem.word()}`,
);
const Tick = defineLogEvent(`${faker.lorem.word()}.${faker.lorem.word()}`);

describe("FakeLogger", () => {
  it.each<LogLevel>(["debug", "info", "warn", "error"])(
    "records a %s entry with the event name and its fields",
    (level) => {
      const logger = new FakeLogger();
      const accountId = faker.database.mongodbObjectId();

      logger[level](AccountSeen, { accountId });

      expect(logger.entries).toStrictEqual([
        { level, event: AccountSeen.name, fields: { accountId } },
      ]);
    },
  );

  it("records an event without fields", () => {
    const logger = new FakeLogger();

    logger.info(Tick);

    expect(logger.entries).toStrictEqual([
      { level: "info", event: Tick.name, fields: undefined },
    ]);
  });

  it("keeps the entries in order", () => {
    const logger = new FakeLogger();

    logger.warn(Tick);
    logger.error(Tick);

    expect(logger.entries.map((entry) => entry.level)).toStrictEqual([
      "warn",
      "error",
    ]);
  });

  it("checks the fields of each event at compile time", () => {
    const logger = new FakeLogger();
    const accountId = faker.database.mongodbObjectId();

    // @ts-expect-error the event declares fields
    logger.info(AccountSeen);
    // @ts-expect-error a declared field is missing
    logger.info(AccountSeen, {});
    // @ts-expect-error a field has the wrong type
    logger.info(AccountSeen, { accountId: faker.number.int() });
    // @ts-expect-error the event declares no fields
    logger.info(Tick, { accountId });
    // @ts-expect-error only defined events are accepted
    logger.info(AccountSeen.name, { accountId });

    expect(logger.entries).toHaveLength(5);
  });
});
