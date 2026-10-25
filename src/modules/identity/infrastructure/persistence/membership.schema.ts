import { Replace } from "@shared/types/replace";
import { Schema, Types } from "mongoose";

import {
  MembershipPermission,
  MembershipRole,
  MembershipSnapshot,
} from "@/identity/domain/membership.entity";

export type MembershipDocument = Replace<
  MembershipSnapshot,
  {
    _id: Types.ObjectId;
    accountId: Types.ObjectId;
    createdBy: Types.ObjectId;
  },
  "id"
>;

export const membershipSchema = new Schema<MembershipDocument>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: Object.values(MembershipRole),
      required: true,
    },
    permissions: {
      type: [{ type: String, enum: Object.values(MembershipPermission) }],
      required: true,
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
  },
  {
    collection: "memberships",
    versionKey: false,
  },
);
