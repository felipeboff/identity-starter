import { Schema, Types } from "mongoose";

const EFFECT_TYPE = /^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$/;

export type OutboxDocument = {
  _id: Types.ObjectId;
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
    type: {
      type: String,
      required: true,
      match: EFFECT_TYPE,
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
