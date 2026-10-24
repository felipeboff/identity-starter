import type { Entry, Inbound, Next } from "./handler";

export class Dispatcher {
  async dispatch<TActor>(
    entry: Entry<TActor>,
    inbound: Inbound,
  ): Promise<unknown> {
    const middlewares = entry.middlewares ?? [];

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
