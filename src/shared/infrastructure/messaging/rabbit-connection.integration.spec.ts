import { once } from "node:events";
import { type AddressInfo, createServer } from "node:net";

import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useRabbitMq } from "@shared/testing/rabbitmq-broker";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RabbitConnection } from "./rabbit-connection";

const freePort = async () => {
  const server = createServer().listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

describe("RabbitConnection", () => {
  const broker = useRabbitMq();
  const opened: RabbitConnection[] = [];

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((connection) => connection.close()));
  });

  const connect = async () => {
    const logger = new FakeLogger();
    const connection = new RabbitConnection({
      url: broker.url(),
      logger,
      reconnectMs: 50,
    });
    opened.push(connection);
    await connection.connect();
    return { connection, logger, host: new URL(broker.url()).host };
  };

  it("connects and logs the host it connected to", async () => {
    const { connection, logger, host } = await connect();

    expect(connection.manager.isConnected()).toBe(true);
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.INFO,
        event: SharedLogEvent.BrokerConnected.name,
        fields: { host },
      },
    ]);
  });

  it("fails with shared.broker_unavailable and logs when the broker does not answer", async () => {
    const logger = new FakeLogger();
    const host = `127.0.0.1:${await freePort()}`;
    const connection = new RabbitConnection({
      url: `amqp://${host}`,
      logger,
      connectTimeoutMs: 300,
      reconnectMs: 50,
    });

    await expectAppError(connection.connect(), SharedError.BrokerUnavailable);

    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.ERROR,
        event: SharedLogEvent.BrokerConnectionFailed.name,
        fields: { host, error: expect.any(Error) as Error },
      },
    ]);
    expect(connection.manager.isConnected()).toBe(false);
  });

  it("logs when the connection drops and comes back", async () => {
    const { connection, logger, host } = await connect();

    await broker.dropConnections();
    await vi.waitFor(() => {
      expect(logger.entries).toHaveLength(3);
    });

    expect(logger.entries.slice(1)).toStrictEqual([
      {
        level: LogLevel.WARN,
        event: SharedLogEvent.BrokerDisconnected.name,
        fields: { host, error: expect.any(Error) as Error },
      },
      {
        level: LogLevel.INFO,
        event: SharedLogEvent.BrokerConnected.name,
        fields: { host },
      },
    ]);
    expect(connection.manager.isConnected()).toBe(true);
  });

  it("closes without logging a disconnection", async () => {
    const { connection, logger } = await connect();

    await connection.close();

    expect(connection.manager.isConnected()).toBe(false);
    expect(logger.entries).toHaveLength(1);
  });
});
