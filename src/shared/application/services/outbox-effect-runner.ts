import { isAppError } from "../../domain/errors/app-error";
import { SharedError } from "../../domain/errors/shared.error";
import { SharedLogEvent } from "../logging/shared.log-event";
import type { Clock } from "../ports/clock";
import type { Logger } from "../ports/logger";
import type { OutboxEffectHandlers, OutboxPayload } from "../ports/outbox";
import type { OutboxStore } from "../ports/outbox-store";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const HANDLER_MISSING = "shared.outbox_handler_missing";

export type OutboxAttempt = Readonly<{
  id: string;
  type: string;
  payload: OutboxPayload;
  attempt: number;
  maxAttempts: number;
}>;

export const OutboxRunOutcome = {
  PROCESSED: "processed",
  RETRY: "retry",
  ABANDONED: "abandoned",
} as const;

export type OutboxRunResult =
  | Readonly<{ outcome: typeof OutboxRunOutcome.PROCESSED }>
  | Readonly<{ outcome: typeof OutboxRunOutcome.RETRY; error: unknown }>
  | Readonly<{ outcome: typeof OutboxRunOutcome.ABANDONED; reason: string }>;

export type OutboxEffectRunnerDeps = Readonly<{
  store: OutboxStore;
  handlers: OutboxEffectHandlers;
  clock: Clock;
  logger: Logger;
}>;

export class OutboxEffectRunner {
  constructor(private readonly deps: OutboxEffectRunnerDeps) {}

  async run(attempt: OutboxAttempt): Promise<OutboxRunResult> {
    const handler = this.deps.handlers[attempt.type];
    if (handler === undefined) return this.abandon(attempt, HANDLER_MISSING);

    try {
      await handler.handle({ id: attempt.id, payload: attempt.payload });
    } catch (error) {
      return this.fail(attempt, error);
    }

    const processedAt = this.deps.clock.now();
    await this.deps.store.markProcessed({
      id: attempt.id,
      processedAt,
      expiresAt: new Date(processedAt.getTime() + RETENTION_MS),
    });
    return { outcome: OutboxRunOutcome.PROCESSED };
  }

  private async fail(
    attempt: OutboxAttempt,
    error: unknown,
  ): Promise<OutboxRunResult> {
    const lastError = error instanceof Error ? error.message : String(error);
    if (attempt.attempt >= attempt.maxAttempts || this.isRefused(error)) {
      return this.abandon(attempt, lastError);
    }

    this.deps.logger.warn(SharedLogEvent.OutboxEffectFailed, {
      id: attempt.id,
      type: attempt.type,
      attempts: attempt.attempt,
      error,
    });
    return { outcome: OutboxRunOutcome.RETRY, error };
  }

  private isRefused(error: unknown): boolean {
    return isAppError(error) && error.code === SharedError.InputInvalid.code;
  }

  private async abandon(
    attempt: OutboxAttempt,
    lastError: string,
  ): Promise<OutboxRunResult> {
    const failedAt = this.deps.clock.now();
    await this.deps.store.markFailed({
      id: attempt.id,
      attempts: attempt.attempt,
      lastError,
      failedAt,
      expiresAt: new Date(failedAt.getTime() + RETENTION_MS),
    });
    this.deps.logger.error(SharedLogEvent.OutboxEffectAbandoned, {
      id: attempt.id,
      type: attempt.type,
      attempts: attempt.attempt,
    });
    return { outcome: OutboxRunOutcome.ABANDONED, reason: lastError };
  }
}
