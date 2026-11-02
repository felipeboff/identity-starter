import { faker } from "@faker-js/faker";
import { Queue } from "bullmq";
import { RedisMemoryServer } from "redis-memory-server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FakeLogger } from "../../testing/fake-logger";
import { useMemoryRedis } from "../../testing/memory-redis";
import { RedisConnection } from "../redis/redis-connection";

import { BullOutboxQueue } from "./bull-outbox-queue";

const buildEffect = () => ({
  id: faker.database.mongodbObjectId(),
  type: `${faker.lorem.word()}.${faker.lorem.word()}`,
  payload: {
    to: faker.internet.email(),
    token: faker.string.alphanumeric(32),
  },
  attempts: 0,
});

describe("BullOutboxQueue", () => {
  const redis = useMemoryRedis();
  const closing: { close(): Promise<void> }[] = [];

  afterEach(async () => {
    for (const open of closing.splice(0).reverse()) await open.close();
    vi.restoreAllMocks();
  });

  const connect = async (url: string) => {
    const connection = new RedisConnection({ url, logger: new FakeLogger() });
    await connection.connect();
    return connection;
  };

  const create = async () => {
    const prefix = faker.string.alpha(12);
    const connection = await connect(redis.url());
    const outboxQueue = new BullOutboxQueue({
      redis: connection.client,
      url: redis.url(),
      prefix,
    });
    const queue = new Queue("outbox", {
      connection: { url: redis.url() },
      prefix,
    });
    closing.push(connection, outboxQueue, queue);
    return { outboxQueue, queue };
  };

  it("adds a job named after the effect type with its id and retry policy", async () => {
    const { outboxQueue, queue } = await create();
    const effect = buildEffect();

    await outboxQueue.enqueue(effect);

    const job = await queue.getJob(effect.id);
    expect(job?.name).toBe(effect.type);
    expect(job?.data).toStrictEqual({ payload: effect.payload });
    expect(job?.opts).toMatchObject({
      jobId: effect.id,
      attempts: 8,
      backoff: { type: "exponential", delay: 30_000, jitter: 1 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  });

  it("keeps a single job for the same effect id", async () => {
    const { outboxQueue, queue } = await create();
    const effect = buildEffect();

    await outboxQueue.enqueue(effect);
    await outboxQueue.enqueue(effect);

    expect(await queue.getJobCounts("waiting")).toStrictEqual({ waiting: 1 });
  });

  it("survives an error event from its Redis connection", async () => {
    const on = vi.spyOn(Queue.prototype, "on");
    await create();
    const [outboxQueue] = on.mock.contexts as Queue[];

    expect(outboxQueue.emit("error", new Error(faker.lorem.sentence()))).toBe(
      true,
    );
  });

  it("fails an enqueue at once, and still closes, once Redis goes away", async () => {
    const server = await RedisMemoryServer.create();
    const url = `redis://${await server.getHost()}:${await server.getPort()}`;
    const connection = await connect(url);
    const outboxQueue = new BullOutboxQueue({
      redis: connection.client,
      url,
      prefix: faker.string.alpha(12),
    });
    await outboxQueue.enqueue(buildEffect());
    await server.stop();

    await expect(outboxQueue.enqueue(buildEffect())).rejects.toThrow(
      "Stream isn't writeable",
    );
    await expect(outboxQueue.close()).resolves.toBeUndefined();
    await connection.close();
  });
});
