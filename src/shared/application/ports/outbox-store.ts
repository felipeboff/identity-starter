import type { OutboxPayload } from "./outbox";

export type OutboxEffect = Readonly<{
  id: string;
  type: string;
  payload: OutboxPayload;
  attempts: number;
}>;

export type OutboxReservation = Readonly<{
  now: Date;
  lockedUntil: Date;
}>;

export type OutboxCompletion = Readonly<{
  id: string;
  processedAt: Date;
  expiresAt: Date;
}>;

export type OutboxRetry = Readonly<{
  id: string;
  attempts: number;
  lastError: string;
  nextAttemptAt: Date;
}>;

export type OutboxAbandonment = Readonly<{
  id: string;
  attempts: number;
  lastError: string;
  failedAt: Date;
  expiresAt: Date;
}>;

export type OutboxStore = {
  reserve(reservation: OutboxReservation): Promise<OutboxEffect | null>;
  markProcessed(completion: OutboxCompletion): Promise<void>;
  scheduleRetry(retry: OutboxRetry): Promise<void>;
  markFailed(abandonment: OutboxAbandonment): Promise<void>;
};
