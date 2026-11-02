import { Writable } from "node:stream";

import { faker } from "@faker-js/faker";
import { defineLogEvent } from "@shared/application/logging/log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { describe, expect, it } from "vitest";

import { AsyncLocalLogContext } from "./async-local-log-context";
import { PinoLogger, PinoLoggerOptions } from "./pino-logger";

const AccountSeen = defineLogEvent<Record<string, unknown>>(
  `${faker.lorem.word()}.${faker.lorem.word()}`,
);
const Tick = defineLogEvent(`${faker.lorem.word()}.${faker.lorem.word()}`);

const createOutput = () => {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  const lines = () =>
    chunks
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { destination, chunks, lines };
};

const createLogger = (overrides: Partial<PinoLoggerOptions> = {}) => {
  const output = createOutput();
  const options: PinoLoggerOptions = {
    service: faker.lorem.slug(),
    environment: faker.lorem.word(),
    level: LogLevel.DEBUG,
    format: "json",
    destination: output.destination,
    context: new AsyncLocalLogContext(),
    ...overrides,
  };
  return { logger: PinoLogger.create(options), options, ...output };
};

describe("PinoLogger", () => {
  it("writes one JSON line with level, time, service, environment, event and fields", () => {
    const { logger, options, lines } = createLogger();
    const accountId = faker.database.mongodbObjectId();

    logger.info(AccountSeen, { accountId });

    expect(lines()).toStrictEqual([
      {
        level: LogLevel.INFO,
        time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown,
        service: options.service,
        environment: options.environment,
        event: AccountSeen.name,
        accountId,
      },
    ]);
  });

  it.each(Object.values(LogLevel))("writes %s entries", (level) => {
    const { logger, lines } = createLogger();

    logger[level](Tick);

    expect(lines()).toStrictEqual([
      expect.objectContaining({ level, event: Tick.name }),
    ]);
  });

  it("drops entries below the configured level", () => {
    const { logger, lines } = createLogger({ level: LogLevel.WARN });

    logger.debug(Tick);
    logger.info(Tick);
    logger.warn(Tick);

    expect(lines().map((line) => line.level)).toStrictEqual([LogLevel.WARN]);
  });

  it("serializes an error field with its type, message and stack", () => {
    const { logger, lines } = createLogger();
    const error = new TypeError(faker.lorem.sentence());

    logger.error(AccountSeen, { error });

    expect(lines()[0]?.error).toMatchObject({
      type: "TypeError",
      message: error.message,
      stack: expect.stringContaining(error.message) as unknown,
    });
  });

  it("redacts secrets at the top level and one object deep", () => {
    const { logger, lines } = createLogger();

    logger.info(AccountSeen, {
      password: faker.internet.password(),
      body: { refreshToken: faker.string.alphanumeric(32) },
      headers: { authorization: `Bearer ${faker.string.alphanumeric(40)}` },
    });

    expect(lines()[0]).toMatchObject({
      password: "[redacted]",
      body: { refreshToken: "[redacted]" },
      headers: { authorization: "[redacted]" },
    });
  });

  it("adds a child's bindings to every entry", () => {
    const { logger, lines } = createLogger();
    const module = faker.lorem.word();

    logger.child({ module }).info(Tick);

    expect(lines()).toStrictEqual([
      expect.objectContaining({ module, event: Tick.name }),
    ]);
  });

  it("writes a human-readable line in the pretty format", () => {
    const { logger, chunks } = createLogger({ format: "pretty" });

    logger.info(Tick);

    const output = chunks.join("");
    expect(output).toContain(Tick.name);
    expect(() => JSON.parse(output) as unknown).toThrow();
  });

  it("adds the fields of the current log context to every entry", () => {
    const context = new AsyncLocalLogContext();
    const { logger, lines } = createLogger({ context });
    const requestId = faker.string.uuid();
    const accountId = faker.database.mongodbObjectId();

    context.run({ requestId }, () => {
      context.add({ accountId });
      logger.info(Tick);
    });

    expect(lines()).toStrictEqual([
      expect.objectContaining({ event: Tick.name, requestId, accountId }),
    ]);
  });
});
