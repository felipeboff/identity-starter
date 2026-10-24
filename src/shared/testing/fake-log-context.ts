import type { LogFields } from "../application/logging/log-event";
import type { LogContext } from "../application/ports/log-context";

/** Records what was added; assert on `added`. */
export class FakeLogContext implements LogContext {
  readonly added: LogFields[] = [];

  add(fields: LogFields): void {
    this.added.push(fields);
  }
}
