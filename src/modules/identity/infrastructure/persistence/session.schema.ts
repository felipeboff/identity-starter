import { Replace } from "@shared/types/replace";
import { Schema, Types } from "mongoose";

import {
  SessionRevocationReason,
  SessionSnapshot,
} from "@/identity/domain/session.entity";

export type SessionDocument = Replace<
  SessionSnapshot,
  {
    _id: Types.ObjectId;
    accountId: Types.ObjectId;
    credentialId: Types.ObjectId;
    membershipId: Types.ObjectId;
    acceptedByAccountId: Types.ObjectId | null;
  },
  "id"
>;

export const sessionSchema = new Schema<SessionDocument>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    credentialId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    membershipId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    version: {
      type: Number,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
    },
    acceptedByAccountId: {
      type: Schema.Types.ObjectId,
    },
    revokedReason: {
      type: String,
      enum: [...Object.values(SessionRevocationReason), null],
    },
  },
  {
    collection: "sessions",
    versionKey: false,
  },
);

sessionSchema.index({ accountId: 1, revokedAt: 1 });
