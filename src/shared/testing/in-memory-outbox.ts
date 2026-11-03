import { faker } from "@faker-js/faker";

import type { Clock } from "../application/ports/clock";
import {
  type Outbox,
  OutboxKind,
  type OutboxMessage,
  type OutboxPayload,
} from "../application/ports/outbox";
import type {
  OutboxAbandonment,
  OutboxCompletion,
  OutboxEntry,
  OutboxHandOver,
  OutboxReservation,
  OutboxStore,
} from "../application/ports/outbox-store";

import type { InMemoryTransactionRunner } from "./in-memory-transaction-runner";

export type OutboxEntrySnapshot = Readonly<{
  id: string;
  kind: OutboxKind;
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
  private readonly snapshots = new Map<string, OutboxEntrySnapshot>();

  constructor(private readonly deps: InMemoryOutboxDeps) {}

  publish(message: OutboxMessage): Promise<void> {
    const id = faker.database.mongodbObjectId();
    const at = this.deps.clock.now();
    this.snapshots.set(id, {
      id,
      kind: message.kind,
      type: message.type,
      payload: { ...message.payload },
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

  async publishAll(messages: readonly OutboxMessage[]): Promise<void> {
    for (const message of messages) await this.publish(message);
  }

  reserve(reservation: OutboxReservation): Promise<OutboxEntry | null> {
    const now = reservation.now.getTime();
    const [due] = this.entries()
      .filter(
        (entry) =>
          entry.processedAt === null &&
          entry.failedAt === null &&
          entry.nextAttemptAt.getTime() <= now &&
          (entry.lockedUntil === null || entry.lockedUntil.getTime() <= now),
      )
      .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime());
    if (due === undefined) return Promise.resolve(null);

    this.update(due.id, { lockedUntil: reservation.lockedUntil });
    return Promise.resolve({
      id: due.id,
      kind: due.kind,
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
    const entry = this.snapshots.get(handOver.id)!;
    if (entry.processedAt === null && entry.failedAt === null) {
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

  entries(): OutboxEntrySnapshot[] {
    return [...this.snapshots.values()];
  }

  effects(): OutboxEntrySnapshot[] {
    return this.entries().filter((entry) => entry.kind === OutboxKind.EFFECT);
  }

  events(): OutboxEntrySnapshot[] {
    return this.entries().filter((entry) => entry.kind === OutboxKind.EVENT);
  }

  private update(id: string, changes: Partial<OutboxEntrySnapshot>): void {
    this.snapshots.set(id, { ...this.snapshots.get(id)!, ...changes });
  }
}
