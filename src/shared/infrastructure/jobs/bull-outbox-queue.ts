import type { OutboxPayload } from "@shared/application/ports/outbox";
import type { OutboxQueue } from "@shared/application/ports/outbox-queue";
import type { OutboxEffect } from "@shared/application/ports/outbox-store";
import { Queue } from "bullmq";

import { BullQueueName, type BullSettings } from "./bull-settings";

export const OUTBOX_ATTEMPTS = 8;
const BACKOFF_MS = 30_000;

export type OutboxJobData = Readonly<{
  payload: OutboxPayload;
}>;

export class BullOutboxQueue implements OutboxQueue {
  private readonly queue: Queue<OutboxJobData>;

  constructor(settings: BullSettings) {
    this.queue = new Queue(BullQueueName.OUTBOX, {
      connection: settings.redis,
      prefix: settings.prefix,
    });
    // Errors surface through the enqueues that fail, which the relay logs.
    this.queue.on("error", () => undefined);
  }

  async enqueue(effect: OutboxEffect): Promise<void> {
    await this.queue.add(
      effect.type,
      { payload: effect.payload },
      {
        jobId: effect.id,
        attempts: OUTBOX_ATTEMPTS,
        backoff: { type: "exponential", delay: BACKOFF_MS, jitter: 1 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}
