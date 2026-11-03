import type { OutboxKind, OutboxPayload } from "./outbox";

export type OutboxEffect = Readonly<{
  id: string;
  type: string;
  payload: OutboxPayload;
  attempts: number;
}>;

export type OutboxEntry = OutboxEffect & Readonly<{ kind: OutboxKind }>;

export type OutboxReservation = Readonly<{
  now: Date;
  lockedUntil: Date;
}>;

export type OutboxCompletion = Readonly<{
  id: string;
  processedAt: Date;
  expiresAt: Date;
}>;

export type OutboxHandOver = Readonly<{
  id: string;
  lockedUntil: Date;
}>;

export type OutboxAbandonment = Readonly<{
  id: string;
  attempts: number;
  lastError: string;
  failedAt: Date;
  expiresAt: Date;
}>;

export type OutboxStore = {
  reserve(reservation: OutboxReservation): Promise<OutboxEntry | null>;
  markProcessed(completion: OutboxCompletion): Promise<void>;
  markHandedOver(handOver: OutboxHandOver): Promise<void>;
  markFailed(abandonment: OutboxAbandonment): Promise<void>;
};
