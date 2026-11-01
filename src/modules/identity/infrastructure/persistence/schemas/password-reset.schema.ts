import { Replace } from "@shared/types/replace";
import { Schema, Types } from "mongoose";

import { PasswordResetSnapshot } from "@/identity/domain/password-reset.entity";

export type PasswordResetDocument = Replace<
  PasswordResetSnapshot,
  {
    _id: Types.ObjectId;
    accountId: Types.ObjectId;
  },
  "id"
>;

export const passwordResetSchema = new Schema<PasswordResetDocument>(
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
    collection: "password_resets",
    versionKey: false,
  },
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
