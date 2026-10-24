import type { LogEvent, LogFields } from "../application/logging/log-event";
import type {
  LogFieldsArg,
  LogLevel,
  Logger,
} from "../application/ports/logger";

export type LogEntry = Readonly<{
  level: LogLevel;
  event: string;
  fields: LogFields | undefined;
}>;

export class FakeLogger implements Logger {
  readonly entries: LogEntry[] = [];

  readonly debug = this.recorder("debug");
  readonly info = this.recorder("info");
  readonly warn = this.recorder("warn");
  readonly error = this.recorder("error");

  private recorder(level: LogLevel) {
    return <Fields extends LogFields | undefined>(
      event: LogEvent<Fields>,
      ...fields: LogFieldsArg<NoInfer<Fields>>
    ): void => {
      this.entries.push({
        level,
        event: event.name,
        fields: fields[0],
      });
    };
  }
}
