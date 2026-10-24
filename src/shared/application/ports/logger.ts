import type { LogEvent, LogFields } from "../logging/log-event";

export const LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export type LogFieldsArg<Fields> = [Fields] extends [undefined]
  ? []
  : [fields: Fields];

export type LogMethod = <Fields extends LogFields | undefined>(
  event: LogEvent<Fields>,
  ...fields: LogFieldsArg<NoInfer<Fields>>
) => void;

export type Logger = Readonly<Record<LogLevel, LogMethod>>;
