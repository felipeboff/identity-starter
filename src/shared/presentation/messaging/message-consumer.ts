import type { Entry } from "../handler";

export const MessageMetadata = {
  EVENT_ID: "event-id",
} as const;

export type MessageConsumer = Entry & Readonly<{ event: string }>;
