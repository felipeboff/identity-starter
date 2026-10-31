import { Replace } from "@shared/types/replace";
import { Schema, Types } from "mongoose";

import { EmailVerificationSnapshot } from "@/identity/domain/email-verification.entity";

export type EmailVerificationDocument = Replace<
  EmailVerificationSnapshot,
  {
    _id: Types.ObjectId;
    accountId: Types.ObjectId;
  },
  "id"
>;

export const emailVerificationSchema = new Schema<EmailVerificationDocument>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
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
    version: {
      type: Number,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
    updatedAt: {
      type: Date,
      required: true,
    },
    deletedAt: {
      type: Date,
    },
    consumedAt: {
      type: Date,
    },
  },
  {
    collection: "email_verifications",
    versionKey: false,
  },
);

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
