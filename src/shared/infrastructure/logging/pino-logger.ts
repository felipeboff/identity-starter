import pino, { type DestinationStream, type Logger as Pino } from "pino";
import pretty from "pino-pretty";

import type { LogFields } from "../../application/logging/log-event";
import type {
  LogLevel,
  LogMethod,
  Logger,
} from "../../application/ports/logger";

export type LogFormat = "json" | "pretty";

export type PinoLoggerOptions = Readonly<{
  service: string;
  environment: string;
  level: LogLevel;
  /** `json` for collectors (Loki); `pretty` for a terminal. */
  format: LogFormat;
  destination: DestinationStream;
}>;

/** Secrets that must never reach a log line, at the top level or one object deep. */
const REDACTED_PATHS = [
  "password",
  "newPassword",
  "oldPassword",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
].flatMap((field) => [field, `*.${field}`]);

/** The `Logger` port over Pino: one JSON line per entry, `event` as the message key. */
export class PinoLogger implements Logger {
  readonly debug = this.writer("debug");
  readonly info = this.writer("info");
  readonly warn = this.writer("warn");
  readonly error = this.writer("error");

  private constructor(private readonly pino: Pino) {}

  static create(options: PinoLoggerOptions): PinoLogger {
    const destination =
      options.format === "pretty"
        ? pretty({ destination: options.destination, sync: true })
        : options.destination;

    return new PinoLogger(
      pino(
        {
          level: options.level,
          base: { service: options.service, environment: options.environment },
          messageKey: "event",
          timestamp: pino.stdTimeFunctions.isoTime,
          formatters: { level: (label) => ({ level: label }) },
          redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
          serializers: { error: pino.stdSerializers.err },
        },
        destination,
      ),
    );
  }

  /** A logger whose every entry also carries `bindings`, e.g. `{ module: "identity" }`. */
  child(bindings: LogFields): PinoLogger {
    return new PinoLogger(this.pino.child(bindings));
  }

  private writer(level: LogLevel): LogMethod {
    return (event, ...fields) => {
      this.pino[level](fields[0] ?? {}, event.name);
    };
  }
}
