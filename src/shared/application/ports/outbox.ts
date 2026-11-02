export type OutboxPayload = Readonly<Record<string, unknown>>;

export type OutboxEffectInput = {
  type: string;
  payload: Record<string, unknown>;
};

export type Outbox = {
  record(effect: OutboxEffectInput): Promise<void>;
};

export type OutboxDelivery = Readonly<{
  id: string;
  payload: OutboxPayload;
}>;

export type OutboxEffectHandler = {
  handle(delivery: OutboxDelivery): Promise<void>;
};

export type OutboxEffectHandlers = Readonly<
  Record<string, OutboxEffectHandler>
>;
