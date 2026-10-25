import { Replace } from "@shared/types/replace";
import { Schema, Types } from "mongoose";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type AccountDocument = Replace<
  AccountSnapshot,
  {
    _id: Types.ObjectId;
    createdBy: Types.ObjectId;
  },
  "id"
>;

export const accountSchema = new Schema<AccountDocument>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
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
    lastSeenAt: {
      type: Date,
    },
    emailVerifiedAt: {
      type: Date,
    },
  },
  {
    collection: "accounts",
    versionKey: false,
  },
);
