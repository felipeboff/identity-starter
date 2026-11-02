import { Replace } from "@shared/types/replace";
import { Schema, Types } from "mongoose";

import { EmailChangeSnapshot } from "@/identity/domain/email-change.entity";

export type EmailChangeDocument = Replace<
  EmailChangeSnapshot,
  {
    _id: Types.ObjectId;
    accountId: Types.ObjectId;
  },
  "id"
>;

export const emailChangeSchema = new Schema<EmailChangeDocument>(
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
    newEmail: {
      type: String,
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
    collection: "email_changes",
    versionKey: false,
  },
);

emailChangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
