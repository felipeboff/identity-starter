import { OutboxKind } from "@shared/application/ports/outbox";
import { Schema, Types } from "mongoose";

const ENTRY_TYPE = /^[a-z]+(_[a-z]+)*(\.[a-z]+(_[a-z]+)*){1,2}$/;

export type OutboxDocument = {
  _id: Types.ObjectId;
  kind?: OutboxKind;
  type: string;
  payload: Record<string, unknown> | null;
  attempts: number;
  nextAttemptAt: Date;
  lockedUntil: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  expiresAt: Date | null;
  createdAt: Date;
};

export const outboxSchema = new Schema<OutboxDocument>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    kind: {
      type: String,
      enum: Object.values(OutboxKind),
    },
    type: {
      type: String,
      required: true,
      match: ENTRY_TYPE,
    },
    payload: {
      type: Schema.Types.Mixed,
    },
    attempts: {
      type: Number,
      required: true,
    },
    nextAttemptAt: {
      type: Date,
      required: true,
    },
    lockedUntil: {
      type: Date,
    },
    processedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    lastError: {
      type: String,
    },
    expiresAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: "outbox",
    versionKey: false,
  },
);

outboxSchema.index({ processedAt: 1, failedAt: 1, nextAttemptAt: 1 });
outboxSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
