import type { LogFields } from "../logging/log-event";

export type LogContext = {
  add(fields: LogFields): void;
};
