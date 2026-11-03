export type MessageDelivery = Readonly<{
  id: string;
  payload: unknown;
}>;

export type MessageHandler = {
  handle(delivery: MessageDelivery): Promise<void>;
};

export type MessageSubscription = Readonly<{
  event: string;
  consumer: string;
  handler: MessageHandler;
}>;
