import { AsyncLocalStorage } from "node:async_hooks";

import type { LogFields } from "../../application/logging/log-event";
import type { LogContext } from "../../application/ports/log-context";

/** Per-request log fields kept across `await`s with `AsyncLocalStorage`. */
export class AsyncLocalLogContext implements LogContext {
  private readonly storage = new AsyncLocalStorage<Record<string, unknown>>();

  /** Runs `callback` with its own fields; entries logged inside carry them. */
  run<T>(fields: LogFields, callback: () => T): T {
    return this.storage.run({ ...fields }, callback);
  }

  /** Merges `fields` into the current context; does nothing outside `run`. */
  add(fields: LogFields): void {
    const store = this.storage.getStore();
    if (store) Object.assign(store, fields);
  }

  get(): LogFields | undefined {
    const store = this.storage.getStore();
    return store && { ...store };
  }

  /** Keeps `callback` in the current context when something calls it later, e.g. an event. */
  bind<T extends (...args: never[]) => unknown>(callback: T): T {
    return AsyncLocalStorage.bind(callback);
  }
}
