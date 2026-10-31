import { once } from "node:events";
import { type AddressInfo, createServer } from "node:net";

import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import { Redis } from "ioredis";
import { describe, expect, it } from "vitest";

import { RedisConnection } from "./redis-connection";

const freePort = async () => {
  const server = createServer().listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

describe("RedisConnection", () => {
  const redis = useMemoryRedis();

  it("connects and logs the host it connected to", async () => {
    const logger = new FakeLogger();
    const connection = new RedisConnection({ url: redis.url(), logger });

    await connection.connect();

    expect(await connection.client.ping()).toBe("PONG");
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.INFO,
        event: SharedLogEvent.CacheConnected.name,
        fields: { host: new URL(redis.url()).host },
      },
    ]);
    await connection.close();
  });

  it("reconnects on its own once it was connected", async () => {
    const connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    await connection.connect();
    const admin = new Redis(redis.url());

    await admin.call("CLIENT", "KILL", "TYPE", "normal", "SKIPME", "yes");
    await once(connection.client, "ready");

    expect(await connection.client.ping()).toBe("PONG");
    await admin.quit();
    await connection.close();
  });

  it("fails a command Redis holds past commandTimeoutMs", async () => {
    const connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
      commandTimeoutMs: faker.number.int({ min: 20, max: 50 }),
    });
    await connection.connect();
    const admin = new Redis(redis.url());
    await admin.call("CLIENT", "PAUSE", "300", "ALL");

    await expect(
      connection.client.get(faker.string.alphanumeric(16)),
    ).rejects.toThrow("Command timed out");

    await admin.quit();
    await connection.close();
  });

  it("refuses to start when Redis does not answer", async () => {
    const logger = new FakeLogger();
    const url = `redis://127.0.0.1:${await freePort()}`;
    const connection = new RedisConnection({ url, logger });

    await expectAppError(connection.connect(), SharedError.CacheUnavailable);

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.CacheConnectionFailed.name,
        fields: {
          host: new URL(url).host,
          error: expect.any(Error) as unknown,
        },
      },
    ]);
    expect(connection.client.status).toBe("end");
  });

  it("closes a connection that is open", async () => {
    const connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    await connection.connect();

    await connection.close();

    await expect(connection.client.ping()).rejects.toThrow();
  });

  it("closes a connection that never opened", async () => {
    const connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });

    await connection.close();

    expect(connection.client.status).toBe("end");
  });
});
