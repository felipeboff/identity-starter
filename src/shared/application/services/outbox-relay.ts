import { SharedLogEvent } from "../logging/shared.log-event";
import type { Clock } from "../ports/clock";
import type { Logger } from "../ports/logger";
import type { OutboxQueue } from "../ports/outbox-queue";
import type { OutboxStore } from "../ports/outbox-store";

const IDLE_MS = 1_000;
const LOCK_MS = 30_000;
const HAND_OVER_MS = 2 * 60 * 60 * 1_000;

export type OutboxRelayDeps = Readonly<{
  store: OutboxStore;
  queue: OutboxQueue;
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
    const effect = await this.deps.store.reserve({
      now,
      lockedUntil: new Date(now.getTime() + LOCK_MS),
    });
    if (effect === null) return false;

    await this.deps.queue.enqueue(effect);
    await this.deps.store.markHandedOver({
      id: effect.id,
      lockedUntil: new Date(this.deps.clock.now().getTime() + HAND_OVER_MS),
    });
    return true;
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
