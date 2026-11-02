import type { Entry } from "../handler";

export const OutboxMetadata = {
  EFFECT_ID: "effect-id",
} as const;

export type OutboxConsumer = Entry & Readonly<{ type: string }>;
