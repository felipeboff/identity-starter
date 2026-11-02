import { faker } from "@faker-js/faker";
import { Queue, Worker } from "bullmq";
import { RedisMemoryServer } from "redis-memory-server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharedLogEvent } from "../../application/logging/shared.log-event";
import { LogLevel } from "../../application/ports/logger";
import { Dispatcher } from "../../presentation/dispatcher";
import { Handler } from "../../presentation/handler";
import type { ScheduledJob } from "../../presentation/scheduling/scheduled-job";
import { SchemaParser } from "../../presentation/schema-parser";
import { FakeLogger } from "../../testing/fake-logger";
import { useMemoryRedis } from "../../testing/memory-redis";
import { RedisConnection } from "../redis/redis-connection";

import { BullScheduledJobs } from "./bull-scheduled-jobs";

const EVERY_SECOND = "* * * * * *";

class RecordingHandler extends Handler {
  readonly name = `${faker.lorem.word()}.${faker.string.alpha(10)}`;
  readonly runs: number[] = [];

  handle(): Promise<void> {
    this.runs.push(Math.floor(Date.now() / 1_000));
    return Promise.resolve();
  }
}

class FailingHandler extends Handler<{ deps: { error: Error } }> {
  readonly name = `${faker.lorem.word()}.${faker.string.alpha(10)}`;

  handle(): Promise<void> {
    return Promise.reject(this.deps.error);
  }
}

const buildJob = (overrides: Partial<ScheduledJob> = {}): ScheduledJob => ({
  name: `${faker.lorem.word()}.${faker.string.alpha(10)}`,
  schedule: { pattern: "0 9 * * *", tz: "America/Sao_Paulo" },
  handler: new RecordingHandler(),
  ...overrides,
});

describe("BullScheduledJobs", () => {
  const redis = useMemoryRedis();
  const closing: { close(): Promise<void> }[] = [];

  afterEach(async () => {
    for (const open of closing.splice(0).reverse()) await open.close();
    vi.restoreAllMocks();
  });

  const create = async (
    jobs: readonly ScheduledJob[],
    prefix = faker.string.alpha(12),
  ) => {
    const connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    await connection.connect();
    const logger = new FakeLogger();
    const scheduled = new BullScheduledJobs({
      settings: { redis: connection.client, url: redis.url(), prefix },
      jobs,
      dispatcher: new Dispatcher({ parser: new SchemaParser() }),
      logger,
    });
    const queue = new Queue("scheduled", {
      connection: { url: redis.url() },
      prefix,
    });
    closing.push(connection, scheduled, queue);
    return { scheduled, queue, logger, prefix };
  };

  it("upserts one scheduler per declared job", async () => {
    const daily = buildJob();
    const hourly = buildJob({ schedule: { pattern: "0 * * * *", tz: "UTC" } });
    const { scheduled, queue } = await create([daily, hourly]);

    await scheduled.sync();
    await scheduled.sync();

    const schedulers = await queue.getJobSchedulers();
    expect(schedulers).toHaveLength(2);
    for (const job of [daily, hourly]) {
      expect(schedulers.find((one) => one.key === job.name)).toMatchObject({
        name: job.name,
        pattern: job.schedule.pattern,
        tz: job.schedule.tz,
        template: {
          opts: {
            attempts: 3,
            backoff: { type: "exponential", delay: 60_000 },
          },
        },
      });
    }
  });

  it("removes a scheduler no module declares", async () => {
    const declared = buildJob();
    const { scheduled, queue } = await create([declared]);
    const stale = buildJob();
    await queue.upsertJobScheduler(
      stale.name,
      { pattern: stale.schedule.pattern, tz: stale.schedule.tz },
      { name: stale.name },
    );

    await scheduled.sync();

    expect(
      (await queue.getJobSchedulers()).map((scheduler) => scheduler.key),
    ).toStrictEqual([declared.name]);
  });

  it("runs each occurrence once with two workers", async () => {
    const handler = new RecordingHandler();
    const job = buildJob({
      schedule: { pattern: EVERY_SECOND, tz: "UTC" },
      handler,
    });
    const first = await create([job]);
    const second = await create([job], first.prefix);
    await first.scheduled.sync();
    await second.scheduled.sync();

    await new Promise((resolve) => setTimeout(resolve, 3_200));

    expect(handler.runs.length).toBeGreaterThanOrEqual(2);
    expect(new Set(handler.runs).size).toBe(handler.runs.length);
  }, 10_000);

  it("logs each failure of a scheduled job", async () => {
    const error = new Error(faker.lorem.sentence());
    const job = buildJob({
      schedule: { pattern: EVERY_SECOND, tz: "UTC" },
      handler: new FailingHandler({ error }),
    });
    const { scheduled, logger } = await create([job]);

    await scheduled.sync();

    await vi.waitFor(
      () => {
        expect(logger.entries[0]).toStrictEqual({
          level: LogLevel.WARN,
          event: SharedLogEvent.ScheduledJobFailed.name,
          fields: { name: job.name, attempts: 1, error },
        });
      },
      { timeout: 3_000 },
    );
  });

  it("fails a job no module declares without another attempt", async () => {
    const { queue, logger } = await create([]);
    const ghost = buildJob();
    await queue.upsertJobScheduler(
      ghost.name,
      { pattern: EVERY_SECOND, tz: "UTC" },
      { name: ghost.name, opts: { attempts: 3 } },
    );

    await vi.waitFor(
      () => {
        expect(logger.entries[0]).toMatchObject({
          level: LogLevel.WARN,
          event: SharedLogEvent.ScheduledJobFailed.name,
          fields: { name: ghost.name, attempts: 1 },
        });
      },
      { timeout: 3_000 },
    );
    const failed = await queue.getFailed();
    expect(failed.map((job) => [job.name, job.attemptsMade])).toContainEqual([
      ghost.name,
      1,
    ]);
  });

  it("survives an error event from its Redis connections", async () => {
    const queueOn = vi.spyOn(Queue.prototype, "on");
    const workerOn = vi.spyOn(Worker.prototype, "on");
    await create([]);
    const [queue] = queueOn.mock.contexts as Queue[];
    const [worker] = workerOn.mock.contexts as Worker[];

    expect(queue.emit("error", new Error(faker.lorem.sentence()))).toBe(true);
    expect(worker.emit("error", new Error(faker.lorem.sentence()))).toBe(true);
  });

  it("closes even when Redis is away", async () => {
    const server = await RedisMemoryServer.create();
    const url = `redis://${await server.getHost()}:${await server.getPort()}`;
    const connection = new RedisConnection({ url, logger: new FakeLogger() });
    await connection.connect();
    const scheduled = new BullScheduledJobs({
      settings: {
        redis: connection.client,
        url,
        prefix: faker.string.alpha(12),
      },
      jobs: [],
      dispatcher: new Dispatcher({ parser: new SchemaParser() }),
      logger: new FakeLogger(),
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await server.stop();

    await expect(scheduled.close()).resolves.toBeUndefined();
    await connection.close();
  });
});
