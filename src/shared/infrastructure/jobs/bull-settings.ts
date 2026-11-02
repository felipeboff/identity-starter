import type { Redis } from "ioredis";

export type BullSettings = Readonly<{
  /** The process's `RedisConnection` client, for the queues. */
  redis: Redis;
  /** Where the workers open their own blocking connections. */
  url: string;
  prefix: string;
}>;

export const BullQueueName = {
  OUTBOX: "outbox",
  SCHEDULED: "scheduled",
} as const;
