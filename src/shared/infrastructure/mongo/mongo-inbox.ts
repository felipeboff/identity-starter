import type { Inbox, InboxEntry } from "@shared/application/ports/inbox";
import { type Connection, type Model, Types } from "mongoose";

import { type InboxDocument, inboxSchema } from "./inbox.schema";

export class MongoInbox implements Inbox {
  private readonly model: Model<InboxDocument>;

  constructor(connection: Connection) {
    this.model = connection.model<InboxDocument>("InboxEntry", inboxSchema);
  }

  async ready(): Promise<void> {
    await this.model.init();
  }

  async record(entry: InboxEntry): Promise<boolean> {
    const result = await this.model.updateOne(
      { consumer: entry.consumer, eventId: entry.eventId },
      {
        $setOnInsert: {
          _id: new Types.ObjectId(),
          processedAt: entry.processedAt,
          expiresAt: entry.expiresAt,
        },
      },
      { upsert: true },
    );
    return result.upsertedCount === 1;
  }
}
