export type OutboxPayload = Readonly<Record<string, unknown>>;

export const OutboxKind = {
  EFFECT: "effect",
  EVENT: "event",
} as const;

export type OutboxKind = (typeof OutboxKind)[keyof typeof OutboxKind];

export type OutboxMessage<
  TKind extends OutboxKind = OutboxKind,
  TType extends string = string,
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = {
  kind: TKind;
  type: TType;
  payload: TPayload;
};

export type Outbox = {
  publish(message: OutboxMessage): Promise<void>;
  publishAll(messages: readonly OutboxMessage[]): Promise<void>;
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
