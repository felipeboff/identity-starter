import {
  type OutboxEffectRunner,
  OutboxRunOutcome,
} from "@shared/application/services/outbox-effect-runner";
import { type Job, UnrecoverableError, Worker } from "bullmq";

import type { OutboxJobData } from "./bull-outbox-queue";
import { BullQueueName, type BullSettings } from "./bull-settings";
import { BullWorkerShutdown } from "./bull-worker-shutdown";

const CONCURRENCY = 5;

export type BullOutboxWorkerDeps = Readonly<{
  settings: BullSettings;
  runner: OutboxEffectRunner;
}>;

export class BullOutboxWorker {
  private readonly worker: Worker<OutboxJobData>;
  private readonly shutdown = new BullWorkerShutdown();

  constructor(private readonly deps: BullOutboxWorkerDeps) {
    this.worker = new Worker(
      BullQueueName.OUTBOX,
      (job) => this.shutdown.track(this.process(job)),
      {
        connection: { url: deps.settings.url },
        prefix: deps.settings.prefix,
        concurrency: CONCURRENCY,
      },
    );
    // Errors surface through the jobs that fail, which the runner logs.
    this.worker.on("error", () => undefined);
  }

  close(): Promise<void> {
    return this.shutdown.close(this.worker);
  }

  private async process(job: Job<OutboxJobData>): Promise<void> {
    const result = await this.deps.runner.run({
      id: job.id!,
      type: job.name,
      payload: job.data.payload,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts!,
    });
    if (result.outcome === OutboxRunOutcome.RETRY) {
      throw result.error instanceof Error
        ? result.error
        : new Error(String(result.error));
    }
    if (result.outcome === OutboxRunOutcome.ABANDONED) {
      throw new UnrecoverableError(result.reason);
    }
  }
}
