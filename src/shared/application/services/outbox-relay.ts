import { isAppError } from "../../domain/errors/app-error";
import { SharedError } from "../../domain/errors/shared.error";
import { SharedLogEvent } from "../logging/shared.log-event";
import type { Clock } from "../ports/clock";
import type { Logger } from "../ports/logger";
import type { OutboxEffectHandlers } from "../ports/outbox";
import type { OutboxEffect, OutboxStore } from "../ports/outbox-store";

const IDLE_MS = 1_000;
const LOCK_MS = 30_000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_CAP_MS = 30 * 60 * 1_000;
const MAX_ATTEMPTS = 8;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const HANDLER_MISSING = "shared.outbox_handler_missing";

export type OutboxRelayDeps = Readonly<{
  store: OutboxStore;
  handlers: OutboxEffectHandlers;
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

    const handler = this.deps.handlers[effect.type];
    if (handler === undefined) {
      await this.abandon(effect, HANDLER_MISSING);
      return true;
    }

    try {
      await handler.handle(effect.payload);
    } catch (error) {
      await this.fail(effect, error);
      return true;
    }

    const processedAt = this.deps.clock.now();
    await this.deps.store.markProcessed({
      id: effect.id,
      processedAt,
      expiresAt: new Date(processedAt.getTime() + RETENTION_MS),
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

  private async fail(effect: OutboxEffect, error: unknown): Promise<void> {
    const attempts = effect.attempts + 1;
    const lastError = error instanceof Error ? error.message : String(error);
    if (attempts >= MAX_ATTEMPTS || this.isRefusedPayload(error)) {
      await this.abandon(effect, lastError);
      return;
    }

    const backoff = Math.min(
      BACKOFF_CAP_MS,
      BACKOFF_BASE_MS * 2 ** (attempts - 1),
    );
    const wait = Math.floor(Math.random() * backoff);
    await this.deps.store.scheduleRetry({
      id: effect.id,
      attempts,
      lastError,
      nextAttemptAt: new Date(this.deps.clock.now().getTime() + wait),
    });
    this.deps.logger.warn(SharedLogEvent.OutboxEffectFailed, {
      id: effect.id,
      type: effect.type,
      attempts,
      error,
    });
  }

  private isRefusedPayload(error: unknown): boolean {
    return isAppError(error) && error.code === SharedError.InputInvalid.code;
  }

  private async abandon(
    effect: OutboxEffect,
    lastError: string,
  ): Promise<void> {
    const attempts = effect.attempts + 1;
    const failedAt = this.deps.clock.now();
    await this.deps.store.markFailed({
      id: effect.id,
      attempts,
      lastError,
      failedAt,
      expiresAt: new Date(failedAt.getTime() + RETENTION_MS),
    });
    this.deps.logger.error(SharedLogEvent.OutboxEffectAbandoned, {
      id: effect.id,
      type: effect.type,
      attempts,
    });
  }
}
