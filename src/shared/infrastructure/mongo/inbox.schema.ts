import { Schema, Types } from "mongoose";

export type InboxDocument = {
  _id: Types.ObjectId;
  consumer: string;
  eventId: string;
  processedAt: Date;
  expiresAt: Date;
};

export const inboxSchema = new Schema<InboxDocument>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    consumer: {
      type: String,
      required: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: "inbox",
    versionKey: false,
  },
);

inboxSchema.index({ consumer: 1, eventId: 1 }, { unique: true });
inboxSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
