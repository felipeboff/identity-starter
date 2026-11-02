import type { Worker } from "bullmq";

/**
 * A graceful `Worker.close()` hangs while Redis is away, so the worker is closed
 * by force once the jobs it is running have finished.
 */
export class BullWorkerShutdown {
  private readonly running = new Set<Promise<void>>();

  track(job: Promise<void>): Promise<void> {
    this.running.add(job);
    return job.finally(() => {
      this.running.delete(job);
    });
  }

  async close(worker: Worker): Promise<void> {
    await worker.pause(true);
    await Promise.allSettled([...this.running]);
    await worker.close(true);
  }
}
