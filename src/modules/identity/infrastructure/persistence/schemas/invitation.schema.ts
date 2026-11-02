import { Replace } from "@shared/types/replace";
import { Schema, Types } from "mongoose";

import { InvitationSnapshot } from "@/identity/domain/invitation.entity";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

export type InvitationDocument = Replace<
  InvitationSnapshot,
  {
    _id: Types.ObjectId;
    createdBy: Types.ObjectId;
    acceptedByAccountId: Types.ObjectId | null;
  },
  "id"
>;

export const invitationSchema = new Schema<InvitationDocument>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(MembershipRole),
    },
    permissions: {
      type: [{ type: String, enum: Object.values(MembershipPermission) }],
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
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedByAccountId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "invitations",
    versionKey: false,
  },
);

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
