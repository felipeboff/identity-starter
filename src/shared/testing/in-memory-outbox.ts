import { faker } from "@faker-js/faker";

import type { Clock } from "../application/ports/clock";
import type {
  Outbox,
  OutboxEffectInput,
  OutboxPayload,
} from "../application/ports/outbox";
import type {
  OutboxAbandonment,
  OutboxCompletion,
  OutboxEffect,
  OutboxHandOver,
  OutboxReservation,
  OutboxStore,
} from "../application/ports/outbox-store";

import type { InMemoryTransactionRunner } from "./in-memory-transaction-runner";

export type OutboxEffectSnapshot = Readonly<{
  id: string;
  type: string;
  payload: OutboxPayload | null;
  attempts: number;
  nextAttemptAt: Date;
  lockedUntil: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}>;

export type InMemoryOutboxDeps = Readonly<{
  transactions: InMemoryTransactionRunner;
  clock: Clock;
}>;

export class InMemoryOutbox implements Outbox, OutboxStore {
  private readonly snapshots = new Map<string, OutboxEffectSnapshot>();

  constructor(private readonly deps: InMemoryOutboxDeps) {}

  record(effect: OutboxEffectInput): Promise<void> {
    const id = faker.database.mongodbObjectId();
    const at = this.deps.clock.now();
    this.snapshots.set(id, {
      id,
      type: effect.type,
      payload: { ...effect.payload },
      attempts: 0,
      nextAttemptAt: at,
      lockedUntil: null,
      processedAt: null,
      failedAt: null,
      lastError: null,
      expiresAt: null,
      createdAt: at,
    });
    this.deps.transactions.onRollback(() => this.snapshots.delete(id));
    return Promise.resolve();
  }

  reserve(reservation: OutboxReservation): Promise<OutboxEffect | null> {
    const now = reservation.now.getTime();
    const [due] = this.effects()
      .filter(
        (effect) =>
          effect.processedAt === null &&
          effect.failedAt === null &&
          effect.nextAttemptAt.getTime() <= now &&
          (effect.lockedUntil === null || effect.lockedUntil.getTime() <= now),
      )
      .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime());
    if (due === undefined) return Promise.resolve(null);

    this.update(due.id, { lockedUntil: reservation.lockedUntil });
    return Promise.resolve({
      id: due.id,
      type: due.type,
      payload: due.payload!,
      attempts: due.attempts,
    });
  }

  markProcessed(completion: OutboxCompletion): Promise<void> {
    this.update(completion.id, {
      payload: null,
      lockedUntil: null,
      processedAt: completion.processedAt,
      expiresAt: completion.expiresAt,
    });
    return Promise.resolve();
  }

  markHandedOver(handOver: OutboxHandOver): Promise<void> {
    const effect = this.snapshots.get(handOver.id)!;
    if (effect.processedAt === null && effect.failedAt === null) {
      this.update(handOver.id, { lockedUntil: handOver.lockedUntil });
    }
    return Promise.resolve();
  }

  markFailed(abandonment: OutboxAbandonment): Promise<void> {
    this.update(abandonment.id, {
      payload: null,
      lockedUntil: null,
      attempts: abandonment.attempts,
      lastError: abandonment.lastError,
      failedAt: abandonment.failedAt,
      expiresAt: abandonment.expiresAt,
    });
    return Promise.resolve();
  }

  effects(): OutboxEffectSnapshot[] {
    return [...this.snapshots.values()];
  }

  private update(id: string, changes: Partial<OutboxEffectSnapshot>): void {
    this.snapshots.set(id, { ...this.snapshots.get(id)!, ...changes });
  }
}
