import { isAppError } from "../../domain/errors/app-error";
import { SharedLogEvent } from "../logging/shared.log-event";
import type { Clock } from "../ports/clock";
import type { Inbox } from "../ports/inbox";
import type { Logger } from "../ports/logger";
import type { MessageSubscription } from "../ports/message-subscription";
import type { TransactionRunner } from "../ports/transaction-runner";

const MAX_ATTEMPTS = 5;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

export type MessageAttempt = Readonly<{
  subscription: MessageSubscription;
  id: string;
  payload: unknown;
  attempt: number;
}>;

export const MessageOutcome = {
  HANDLED: "handled",
  DUPLICATE: "duplicate",
  REFUSED: "refused",
  RETRY: "retry",
  DEAD: "dead",
} as const;

export type MessageOutcome =
  (typeof MessageOutcome)[keyof typeof MessageOutcome];

export type MessageRunnerDeps = Readonly<{
  inbox: Inbox;
  transactions: TransactionRunner;
  clock: Clock;
  logger: Logger;
}>;

export class MessageRunner {
  constructor(private readonly deps: MessageRunnerDeps) {}

  async run(attempt: MessageAttempt): Promise<MessageOutcome> {
    try {
      return await this.deps.transactions.run(() => this.handle(attempt));
    } catch (error) {
      return this.fail(attempt, error);
    }
  }

  private async handle(attempt: MessageAttempt): Promise<MessageOutcome> {
    const processedAt = this.deps.clock.now();
    const fresh = await this.deps.inbox.record({
      consumer: attempt.subscription.consumer,
      eventId: attempt.id,
      processedAt,
      expiresAt: new Date(processedAt.getTime() + RETENTION_MS),
    });
    if (!fresh) return MessageOutcome.DUPLICATE;

    await attempt.subscription.handler.handle({
      id: attempt.id,
      payload: attempt.payload,
    });
    return MessageOutcome.HANDLED;
  }

  private fail(attempt: MessageAttempt, error: unknown): MessageOutcome {
    const fields = {
      event: attempt.subscription.event,
      consumer: attempt.subscription.consumer,
      id: attempt.id,
    };
    if (isAppError(error)) {
      this.deps.logger.warn(SharedLogEvent.MessageRefused, {
        ...fields,
        code: error.code,
      });
      return MessageOutcome.REFUSED;
    }
    if (attempt.attempt >= MAX_ATTEMPTS) {
      this.deps.logger.error(SharedLogEvent.MessageDeadLettered, {
        ...fields,
        attempts: attempt.attempt,
        error,
      });
      return MessageOutcome.DEAD;
    }

    this.deps.logger.warn(SharedLogEvent.MessageFailed, {
      ...fields,
      attempts: attempt.attempt,
      error,
    });
    return MessageOutcome.RETRY;
  }
}
