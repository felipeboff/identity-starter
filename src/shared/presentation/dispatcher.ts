import type { Entry, Inbound, Next } from "./handler";

/** Runs the entry's middlewares in order, then its handler. Errors are thrown to the adapter. */
export class Dispatcher {
  async dispatch<TActor>(
    entry: Entry<TActor>,
    inbound: Inbound,
  ): Promise<unknown> {
    const middlewares = entry.middlewares ?? [];

    // Each middleware types its own hop; the chain is checked where the entry is declared.
    const step =
      (index: number): Next<unknown> =>
      async (current) => {
        const middleware = middlewares[index];
        return middleware
          ? middleware.handle(current as never, step(index + 1))
          : entry.handler.handle(current as Inbound<TActor>);
      };

    return step(0)(inbound);
  }
}
