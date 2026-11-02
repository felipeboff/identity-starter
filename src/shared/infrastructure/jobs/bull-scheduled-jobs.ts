import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Logger } from "@shared/application/ports/logger";
import type { Dispatcher } from "@shared/presentation/dispatcher";
import type { ScheduledJob } from "@shared/presentation/scheduling/scheduled-job";
import { type Job, Queue, UnrecoverableError, Worker } from "bullmq";

import { BullQueueName, type BullSettings } from "./bull-settings";
import { BullWorkerShutdown } from "./bull-worker-shutdown";

const ATTEMPTS = 3;
const BACKOFF_MS = 60_000;
const FAILED_KEPT = 100;

export type BullScheduledJobsDeps = Readonly<{
  settings: BullSettings;
  jobs: readonly ScheduledJob[];
  dispatcher: Dispatcher;
  logger: Logger;
}>;

export class BullScheduledJobs {
  private readonly queue: Queue;
  private readonly worker: Worker;
  private readonly shutdown = new BullWorkerShutdown();

  constructor(private readonly deps: BullScheduledJobsDeps) {
    const prefix = deps.settings.prefix;
    this.queue = new Queue(BullQueueName.SCHEDULED, {
      connection: deps.settings.redis,
      prefix,
    });
    this.worker = new Worker(
      BullQueueName.SCHEDULED,
      (job) => this.shutdown.track(this.process(job)),
      { connection: { url: deps.settings.url }, prefix },
    );

    // Errors surface through the syncs and jobs that fail, which are logged.
    this.queue.on("error", () => undefined);
    this.worker.on("error", () => undefined);
  }

  async sync(): Promise<void> {
    for (const job of this.deps.jobs) {
      await this.queue.upsertJobScheduler(
        job.name,
        { pattern: job.schedule.pattern, tz: job.schedule.tz },
        {
          name: job.name,
          opts: {
            attempts: ATTEMPTS,
            backoff: { type: "exponential", delay: BACKOFF_MS },
            removeOnComplete: true,
            removeOnFail: FAILED_KEPT,
          },
        },
      );
    }

    const declared = new Set(this.deps.jobs.map((job) => job.name));
    for (const scheduler of await this.queue.getJobSchedulers()) {
      if (!declared.has(scheduler.key)) {
        await this.queue.removeJobScheduler(scheduler.key);
      }
    }
  }

  async close(): Promise<void> {
    await this.shutdown.close(this.worker);
    await this.queue.close();
  }

  private async process(job: Job): Promise<void> {
    try {
      const entry = this.deps.jobs.find(
        (candidate) => candidate.name === job.name,
      );
      if (entry === undefined) {
        throw new UnrecoverableError(`${job.name} is not a declared job`);
      }
      await this.deps.dispatcher.dispatch(entry, {
        input: {},
        metadata: {},
        ip: "",
        actor: undefined,
      });
    } catch (error) {
      this.deps.logger.warn(SharedLogEvent.ScheduledJobFailed, {
        name: job.name,
        attempts: job.attemptsMade + 1,
        error,
      });
      throw error;
    }
  }
}
