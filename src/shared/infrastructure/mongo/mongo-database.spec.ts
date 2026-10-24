import { once } from "node:events";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";

import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeLogger } from "@shared/testing/fake-logger";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AsyncLocalLogContext } from "../logging/async-local-log-context";
import { PinoLogger } from "../logging/pino-logger";

import { MongoDatabase, MongoDatabaseOptions } from "./mongo-database";

const freePort = async () => {
  const server = createServer().listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const waitFor = async (condition: () => boolean, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const eventsOf = (logger: FakeLogger) =>
  logger.entries.map((entry) => entry.event);

describe("MongoDatabase", () => {
  let server: MongoMemoryServer;
  const opened: MongoDatabase[] = [];

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
  });

  afterAll(async () => {
    await server.stop();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await Promise.all(opened.splice(0).map((database) => database.close()));
  });

  const databaseName = () =>
    faker.string.alpha({ length: 12, casing: "lower" });

  const open = (overrides: Partial<MongoDatabaseOptions> = {}) => {
    const logger = new FakeLogger();
    const database = new MongoDatabase({
      url: `${server.getUri()}${databaseName()}`,
      logger,
      autoIndex: true,
      ...overrides,
    });
    opened.push(database);
    return { database, logger };
  };

  it("opens the connection before connect resolves", async () => {
    const { database } = open();

    await database.connect();

    expect(database.connection.readyState).toBe(1);
  });

  it("logs the host and database it connected to", async () => {
    const name = databaseName();
    const { database, logger } = open({ url: `${server.getUri()}${name}` });

    await database.connect();

    const { host } = new URL(server.getUri());
    expect(logger.entries).toStrictEqual([
      {
        level: "info",
        event: SharedLogEvent.DatabaseConnected.name,
        fields: { host, database: name },
      },
    ]);
  });

  it("opens the connection with the resolve-hub options", async () => {
    const autoIndex = faker.datatype.boolean();
    const { database } = open({ autoIndex });

    await database.connect();

    expect(database.connection.getClient().options).toMatchObject({
      appName: "resolve-hub",
      serverSelectionTimeoutMS: 10_000,
    });
    expect(database.connection.config).toMatchObject({
      bufferCommands: false,
      autoIndex,
    });
  });

  it("refuses to connect when the server does not answer", async () => {
    const port = await freePort();
    const { database, logger } = open({
      url: `mongodb://127.0.0.1:${port}/${databaseName()}`,
      serverSelectionTimeoutMS: 300,
    });

    await expectAppError(database.connect(), SharedError.DatabaseUnavailable);

    expect(logger.entries).toStrictEqual([
      {
        level: "error",
        event: SharedLogEvent.DatabaseConnectionFailed.name,
        fields: {
          host: `127.0.0.1:${port}`,
          error: expect.any(Error) as unknown,
        },
      },
    ]);
  });

  describe("never logs the password", () => {
    const user = faker.internet.username().replace(/\W/g, "");
    const password = faker.internet.password({ length: 24, pattern: /\w/ });
    let secured: MongoMemoryServer;

    beforeAll(async () => {
      secured = await MongoMemoryServer.create({
        auth: { enable: true, customRootName: user, customRootPwd: password },
      });
    });

    afterAll(async () => {
      await secured.stop();
    });

    const openWithPinoOutput = (url: string) => {
      const chunks: string[] = [];
      const logger = PinoLogger.create({
        service: faker.lorem.slug(),
        environment: faker.lorem.word(),
        level: LogLevel.DEBUG,
        format: "json",
        destination: new Writable({
          write(chunk: Buffer, _encoding, done) {
            chunks.push(chunk.toString());
            done();
          },
        }),
        context: new AsyncLocalLogContext(),
      });
      const database = new MongoDatabase({
        url,
        logger,
        autoIndex: true,
        serverSelectionTimeoutMS: 300,
      });
      opened.push(database);
      return { database, output: () => chunks.join("") };
    };

    it("on a successful connect", async () => {
      const { host } = new URL(secured.getUri());
      const { database, output } = openWithPinoOutput(
        `mongodb://${user}:${password}@${host}/${databaseName()}?authSource=admin`,
      );

      await database.connect();

      expect(output()).toContain(SharedLogEvent.DatabaseConnected.name);
      expect(output()).not.toContain(password);
    });

    it("on a failed connect", async () => {
      const port = await freePort();
      const { database, output } = openWithPinoOutput(
        `mongodb://${user}:${password}@127.0.0.1:${port}/${databaseName()}`,
      );

      await expectAppError(database.connect(), SharedError.DatabaseUnavailable);

      expect(output()).toContain(SharedLogEvent.DatabaseConnectionFailed.name);
      expect(output()).not.toContain(password);
    });
  });

  describe("readiness", () => {
    it("is not ready before it connects", async () => {
      const { database } = open();

      expect(await database.isReady()).toBe(false);
    });

    it("waits 1 second for the ping by default", async () => {
      const { database } = open();
      await database.connect();
      const db = database.connection.db;
      if (!db) throw new Error("connected without a db");
      vi.spyOn(db, "admin").mockReturnValue({
        ping: () => new Promise(() => {}),
      } as unknown as ReturnType<typeof db.admin>);
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      let ready: boolean | undefined;

      const checking = database.isReady().then((result) => (ready = result));
      await vi.advanceTimersByTimeAsync(999);
      const before = ready;
      await vi.advanceTimersByTimeAsync(1);
      await checking;

      expect(before).toBeUndefined();
      expect(ready).toBe(false);
    });

    it("is ready while the server answers the ping", async () => {
      const { database } = open();
      await database.connect();

      expect(await database.isReady()).toBe(true);
    });
  });

  describe("with a server that stops", () => {
    let unstable: MongoMemoryServer;

    beforeAll(async () => {
      unstable = await MongoMemoryServer.create();
    });

    afterAll(async () => {
      await unstable.stop();
    });

    const openUnstable = (overrides: Partial<MongoDatabaseOptions> = {}) =>
      open({
        url: `${unstable.getUri()}${databaseName()}`,
        heartbeatFrequencyMS: 200,
        ...overrides,
      });

    it("is not ready once the ping does not answer in time", async () => {
      const { database } = openUnstable({ pingTimeoutMS: 300 });
      await database.connect();
      await unstable.stop({ doCleanup: false });
      const startedAt = Date.now();

      const ready = await database.isReady();

      const elapsed = Date.now() - startedAt;
      await unstable.start(true);
      expect(ready).toBe(false);
      expect(elapsed).toBeLessThan(300 + 200);
    });

    it("logs when the connection drops and when it comes back", async () => {
      const { database, logger } = openUnstable();
      await database.connect();

      await unstable.stop({ doCleanup: false });
      await waitFor(() =>
        eventsOf(logger).includes(SharedLogEvent.DatabaseDisconnected.name),
      );
      await unstable.start(true);
      await waitFor(() =>
        eventsOf(logger).includes(SharedLogEvent.DatabaseReconnected.name),
      );

      expect(
        logger.entries.filter(
          (entry) => entry.event !== SharedLogEvent.DatabaseConnected.name,
        ),
      ).toStrictEqual([
        {
          level: "warn",
          event: SharedLogEvent.DatabaseDisconnected.name,
          fields: undefined,
        },
        {
          level: "info",
          event: SharedLogEvent.DatabaseReconnected.name,
          fields: undefined,
        },
      ]);
    });
  });

  it("does not warn about a disconnection when it is closed on purpose", async () => {
    const { database, logger } = open();
    await database.connect();

    await database.close();

    expect(database.connection.readyState).toBe(0);
    expect(eventsOf(logger)).toStrictEqual([
      SharedLogEvent.DatabaseConnected.name,
    ]);
  });
});
