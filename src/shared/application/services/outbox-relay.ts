import { SharedLogEvent } from "../logging/shared.log-event";
import type { Clock } from "../ports/clock";
import type { EventBroker } from "../ports/event-broker";
import type { Logger } from "../ports/logger";
import { OutboxKind } from "../ports/outbox";
import type { OutboxQueue } from "../ports/outbox-queue";
import type { OutboxEntry, OutboxStore } from "../ports/outbox-store";

const IDLE_MS = 1_000;
const LOCK_MS = 30_000;
const HAND_OVER_MS = 2 * 60 * 60 * 1_000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

export type OutboxRelayDeps = Readonly<{
  store: OutboxStore;
  queue: OutboxQueue;
  events: EventBroker;
  clock: Clock;
  logger: Logger;
}>;

export class OutboxRelay {
  private running: Promise<void> | undefined;
  private stopped = false;
  private wake = () => {};

  constructor(private readonly deps: OutboxRelayDeps) {}

  start(): void {
    this.running ??= this.loop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.wake();
    await this.running;
  }

  async relayNext(): Promise<boolean> {
    const now = this.deps.clock.now();
    const entry = await this.deps.store.reserve({
      now,
      lockedUntil: new Date(now.getTime() + LOCK_MS),
    });
    if (entry === null) return false;

    if (entry.kind === OutboxKind.EVENT) await this.publish(entry);
    else await this.handOver(entry);
    return true;
  }

  private async publish(entry: OutboxEntry): Promise<void> {
    await this.deps.events.send({
      id: entry.id,
      type: entry.type,
      payload: entry.payload,
    });
    const processedAt = this.deps.clock.now();
    await this.deps.store.markProcessed({
      id: entry.id,
      processedAt,
      expiresAt: new Date(processedAt.getTime() + RETENTION_MS),
    });
  }

  private async handOver(entry: OutboxEntry): Promise<void> {
    await this.deps.queue.enqueue({
      id: entry.id,
      type: entry.type,
      payload: entry.payload,
      attempts: entry.attempts,
    });
    await this.deps.store.markHandedOver({
      id: entry.id,
      lockedUntil: new Date(this.deps.clock.now().getTime() + HAND_OVER_MS),
    });
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      const relayed = await this.relayNext().catch((error: unknown) => {
        this.deps.logger.error(SharedLogEvent.OutboxRelayFailed, { error });
        return false;
      });
      if (!relayed && !this.stopped) await this.idle();
    }
  }

  private idle(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, IDLE_MS);
      this.wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
}
