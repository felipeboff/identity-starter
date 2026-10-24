import { AsyncLocalStorage } from "node:async_hooks";

import type { LogFields } from "../../application/logging/log-event";
import type { LogContext } from "../../application/ports/log-context";

export class AsyncLocalLogContext implements LogContext {
  private readonly storage = new AsyncLocalStorage<Record<string, unknown>>();

  run<T>(fields: LogFields, callback: () => T): T {
    return this.storage.run({ ...fields }, callback);
  }

  add(fields: LogFields): void {
    const store = this.storage.getStore();
    if (store) Object.assign(store, fields);
  }

  get(): LogFields | undefined {
    const store = this.storage.getStore();
    return store && { ...store };
  }

  bind<T extends (...args: never[]) => unknown>(callback: T): T {
    return AsyncLocalStorage.bind(callback);
  }
}
