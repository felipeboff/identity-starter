import type { OutboxEffect } from "./outbox-store";

export type OutboxQueue = {
  enqueue(effect: OutboxEffect): Promise<void>;
};
