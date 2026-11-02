import type { Entry } from "../handler";

export type OutboxConsumer = Entry & Readonly<{ type: string }>;
