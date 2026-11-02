export type OutboxPayload = Readonly<Record<string, unknown>>;

export type OutboxEffectInput = {
  type: string;
  payload: Record<string, unknown>;
};

export type Outbox = {
  record(effect: OutboxEffectInput): Promise<void>;
};

export type OutboxEffectHandler = {
  handle(payload: OutboxPayload): Promise<void>;
};

export type OutboxEffectHandlers = Readonly<
  Record<string, OutboxEffectHandler>
>;
