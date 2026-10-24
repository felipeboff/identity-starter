import type { LogFields } from "../logging/log-event";

/** Fields added here go on every log entry of the current request. */
export type LogContext = {
  add(fields: LogFields): void;
};
