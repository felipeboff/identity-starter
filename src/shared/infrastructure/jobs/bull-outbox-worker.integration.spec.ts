import { faker } from "@faker-js/faker";
import { Queue, Worker } from "bullmq";
import { RedisMemoryServer } from "redis-memory-server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharedLogEvent } from "../../application/logging/shared.log-event";
import { LogLevel } from "../../application/ports/logger";
import {
  type OutboxEffectHandler,
  OutboxKind,
} from "../../application/ports/outbox";
import { OutboxEffectRunner } from "../../application/services/outbox-effect-runner";
import { AppError } from "../../domain/errors/app-error";
import { SharedError } from "../../domain/errors/shared.error";
import { FakeClock } from "../../testing/fake-clock";
import { FakeLogger } from "../../testing/fake-logger";
import { InMemoryOutbox } from "../../testing/in-memory-outbox";
import { InMemoryTransactionRunner } from "../../testing/in-memory-transaction-runner";
import { useMemoryRedis } from "../../testing/memory-redis";
import { RedisConnection } from "../redis/redis-connection";

import { BullOutboxQueue } from "./bull-outbox-queue";
import { BullOutboxWorker } from "./bull-outbox-worker";

describe("BullOutboxWorker", () => {
  const redis = useMemoryRedis();
  const closing: { close(): Promise<void> }[] = [];

  afterEach(async () => {
    for (const open of closing.splice(0).reverse()) await open.close();
    vi.restoreAllMocks();
  });

  const create = async () => {
    const prefix = faker.string.alpha(12);
    const connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    await connection.connect();
    const settings = { redis: connection.client, url: redis.url(), prefix };
    const clock = new FakeClock();
    const outbox = new InMemoryOutbox({
      transactions: new InMemoryTransactionRunner(),
      clock,
    });
    const logger = new FakeLogger();
    const type = `${faker.lorem.word()}.${faker.lorem.word()}`;
    const handle = vi.fn<OutboxEffectHandler["handle"]>().mockResolvedValue();
    const worker = new BullOutboxWorker({
      settings,
      runner: new OutboxEffectRunner({
        store: outbox,
        handlers: { [type]: { handle } },
        clock,
        logger,
      }),
    });
    const outboxQueue = new BullOutboxQueue(settings);
    const queue = new Queue("outbox", {
      connection: { url: redis.url() },
      prefix,
    });
    closing.push(connection, worker, outboxQueue, queue);

    const enqueueOne = async () => {
      await outbox.publish({
        kind: OutboxKind.EFFECT,
        type,
        payload: { to: faker.internet.email() },
      });
      const effect = outbox.effects().at(-1)!;
      await outboxQueue.enqueue({
        id: effect.id,
        type,
        payload: effect.payload!,
        attempts: 0,
      });
      return effect;
    };
    const stored = (id: string) =>
      outbox.effects().find((effect) => effect.id === id)!;

    return { queue, handle, logger, enqueueOne, stored, worker };
  };

  it("puts a failed job back for another attempt", async () => {
    const { queue, handle, logger, enqueueOne, stored } = await create();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const error = new Error(faker.lorem.sentence());
    handle.mockRejectedValueOnce(error);

    const effect = await enqueueOne();

    await vi.waitFor(async () => {
      expect(await queue.getJobState(effect.id)).toBe("delayed");
    });
    expect((await queue.getJob(effect.id))?.attemptsMade).toBe(1);
    expect(stored(effect.id)).toMatchObject({
      processedAt: null,
      failedAt: null,
    });
    expect(logger.entries).toStrictEqual([
      {
        level: LogLevel.WARN,
        event: SharedLogEvent.OutboxEffectFailed.name,
        fields: { id: effect.id, type: effect.type, attempts: 1, error },
      },
    ]);
  });

  it("puts a job back when its handler rejects with something that is not an Error", async () => {
    const { queue, handle, enqueueOne } = await create();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    handle.mockRejectedValueOnce(faker.lorem.sentence());

    const effect = await enqueueOne();

    await vi.waitFor(async () => {
      expect(await queue.getJobState(effect.id)).toBe("delayed");
    });
  });

  it("survives an error event from its Redis connection", async () => {
    const on = vi.spyOn(Worker.prototype, "on");
    await create();
    const [worker] = on.mock.contexts as Worker[];

    expect(worker.emit("error", new Error(faker.lorem.sentence()))).toBe(true);
  });

  it("fails an abandoned job without another attempt", async () => {
    const { queue, handle, enqueueOne, stored } = await create();
    handle.mockRejectedValue(
      new AppError(SharedError.InputInvalid, { violations: [] }),
    );

    const effect = await enqueueOne();

    await vi.waitFor(() => {
      expect(stored(effect.id).failedAt).not.toBeNull();
    });
    expect(await queue.getJob(effect.id)).toBeUndefined();
    expect(stored(effect.id).attempts).toBe(1);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it.each(["succeeds", "is abandoned"])(
    "removes the job from Redis when it ends: %s",
    async (end) => {
      const { queue, handle, enqueueOne, stored } = await create();
      if (end === "is abandoned") {
        handle.mockRejectedValue(
          new AppError(SharedError.InputInvalid, { violations: [] }),
        );
      }

      const effect = await enqueueOne();

      await vi.waitFor(() => {
        const ended = stored(effect.id);
        expect(ended.processedAt ?? ended.failedAt).not.toBeNull();
      });
      await vi.waitFor(async () => {
        expect(await queue.getJob(effect.id)).toBeUndefined();
      });
    },
  );

  it("waits for the job it is running before it closes", async () => {
    const { handle, enqueueOne, stored, worker } = await create();
    let release = () => {};
    handle.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const effect = await enqueueOne();
    await vi.waitFor(() => {
      expect(handle).toHaveBeenCalledTimes(1);
    });

    let closed = false;
    const closing = worker.close().then(() => {
      closed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const closedBeforeTheJobEnded = closed;
    release();
    await closing;

    expect(closedBeforeTheJobEnded).toBe(false);
    expect(stored(effect.id).processedAt).not.toBeNull();
  });

  it("closes even when Redis is away", async () => {
    const server = await RedisMemoryServer.create();
    const url = `redis://${await server.getHost()}:${await server.getPort()}`;
    const connection = new RedisConnection({ url, logger: new FakeLogger() });
    await connection.connect();
    const clock = new FakeClock();
    const worker = new BullOutboxWorker({
      settings: {
        redis: connection.client,
        url,
        prefix: faker.string.alpha(12),
      },
      runner: new OutboxEffectRunner({
        store: new InMemoryOutbox({
          transactions: new InMemoryTransactionRunner(),
          clock,
        }),
        handlers: {},
        clock,
        logger: new FakeLogger(),
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await server.stop();

    await expect(worker.close()).resolves.toBeUndefined();
    await connection.close();
  });
});
