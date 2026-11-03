export type InboxEntry = Readonly<{
  consumer: string;
  eventId: string;
  processedAt: Date;
  expiresAt: Date;
}>;

export type Inbox = {
  /** Answers false when the consumer already recorded this event. */
  record(entry: InboxEntry): Promise<boolean>;
};
