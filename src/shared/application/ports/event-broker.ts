import type { OutboxPayload } from "./outbox";

export type PublishedEvent = Readonly<{
  id: string;
  type: string;
  payload: OutboxPayload;
}>;

export type EventBroker = {
  send(event: PublishedEvent): Promise<void>;
};
