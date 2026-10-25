import { Replace } from "@shared/types/replace";
import { Schema, Types } from "mongoose";

import {
  AuthProvider,
  CredentialSnapshot,
} from "@/identity/domain/credential.entity";

export type CredentialDocument = Replace<
  CredentialSnapshot,
  {
    _id: Types.ObjectId;
    accountId: Types.ObjectId;
  },
  "id"
>;

export const credentialSchema = new Schema<CredentialDocument>(
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
    provider: {
      type: String,
      enum: Object.values(AuthProvider),
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    passwordHash: {
      type: String,
    },
    providerEmail: {
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
    updatedAt: {
      type: Date,
      required: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    collection: "credentials",
    versionKey: false,
  },
);

credentialSchema.index({ provider: 1, subject: 1 }, { unique: true });
