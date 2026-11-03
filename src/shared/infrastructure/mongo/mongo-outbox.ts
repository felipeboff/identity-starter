import type { Clock } from "@shared/application/ports/clock";
import {
  type Outbox,
  OutboxKind,
  type OutboxMessage,
  type OutboxPayload,
} from "@shared/application/ports/outbox";
import type {
  OutboxAbandonment,
  OutboxCompletion,
  OutboxEntry,
  OutboxHandOver,
  OutboxReservation,
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

  async publish(message: OutboxMessage): Promise<void> {
    await new this.model(this.documentOf(message)).save();
  }

  async publishAll(messages: readonly OutboxMessage[]): Promise<void> {
    await this.model.insertMany(
      messages.map((message) => this.documentOf(message)),
    );
  }

  async reserve(reservation: OutboxReservation): Promise<OutboxEntry | null> {
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
      kind: document.kind ?? OutboxKind.EFFECT,
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

  async markHandedOver(handOver: OutboxHandOver): Promise<void> {
    await this.model.updateOne(
      { _id: handOver.id, processedAt: null, failedAt: null },
      { $set: { lockedUntil: handOver.lockedUntil } },
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

  private documentOf(message: OutboxMessage): OutboxDocument {
    const at = this.deps.clock.now();
    return {
      _id: new Types.ObjectId(),
      kind: message.kind,
      type: message.type,
      payload: message.payload,
      attempts: 0,
      nextAttemptAt: at,
      lockedUntil: null,
      processedAt: null,
      failedAt: null,
      lastError: null,
      expiresAt: null,
      createdAt: at,
    };
  }
}
