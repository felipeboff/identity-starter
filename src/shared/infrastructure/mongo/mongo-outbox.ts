import type { Clock } from "@shared/application/ports/clock";
import type {
  Outbox,
  OutboxEffectInput,
  OutboxPayload,
} from "@shared/application/ports/outbox";
import type {
  OutboxAbandonment,
  OutboxCompletion,
  OutboxEffect,
  OutboxReservation,
  OutboxRetry,
  OutboxStore,
} from "@shared/application/ports/outbox-store";
import { type Connection, type Model, Types } from "mongoose";

import { type OutboxDocument, outboxSchema } from "./outbox.schema";

export type MongoOutboxDeps = Readonly<{
  connection: Connection;
  clock: Clock;
}>;

export class MongoOutbox implements Outbox, OutboxStore {
  private readonly model: Model<OutboxDocument>;

  constructor(private readonly deps: MongoOutboxDeps) {
    this.model = deps.connection.model<OutboxDocument>(
      "OutboxEffect",
      outboxSchema,
    );
  }

  async ready(): Promise<void> {
    await this.model.init();
  }

  async record(effect: OutboxEffectInput): Promise<void> {
    const at = this.deps.clock.now();
    await new this.model({
      _id: new Types.ObjectId(),
      type: effect.type,
      payload: effect.payload,
      attempts: 0,
      nextAttemptAt: at,
      lockedUntil: null,
      processedAt: null,
      failedAt: null,
      lastError: null,
      expiresAt: null,
      createdAt: at,
    }).save();
  }

  async reserve(reservation: OutboxReservation): Promise<OutboxEffect | null> {
    const now = reservation.now;
    const document = await this.model
      .findOneAndUpdate(
        {
          processedAt: null,
          failedAt: null,
          nextAttemptAt: { $lte: now },
          $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
        },
        { $set: { lockedUntil: reservation.lockedUntil } },
        { sort: { nextAttemptAt: 1 } },
      )
      .lean<OutboxDocument>();
    if (document === null) return null;

    return {
      id: document._id.toHexString(),
      type: document.type,
      payload: document.payload as OutboxPayload,
      attempts: document.attempts,
    };
  }

  async markProcessed(completion: OutboxCompletion): Promise<void> {
    await this.model.updateOne(
      { _id: completion.id },
      {
        $set: {
          payload: null,
          lockedUntil: null,
          processedAt: completion.processedAt,
          expiresAt: completion.expiresAt,
        },
      },
    );
  }

  async scheduleRetry(retry: OutboxRetry): Promise<void> {
    await this.model.updateOne(
      { _id: retry.id },
      {
        $set: {
          attempts: retry.attempts,
          lastError: retry.lastError,
          nextAttemptAt: retry.nextAttemptAt,
          lockedUntil: null,
        },
      },
    );
  }

  async markFailed(abandonment: OutboxAbandonment): Promise<void> {
    await this.model.updateOne(
      { _id: abandonment.id },
      {
        $set: {
          payload: null,
          lockedUntil: null,
          attempts: abandonment.attempts,
          lastError: abandonment.lastError,
          failedAt: abandonment.failedAt,
          expiresAt: abandonment.expiresAt,
        },
      },
    );
  }
}
