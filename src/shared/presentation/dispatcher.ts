import { type Entry, type Inbound, NO_INPUT, type Next } from "./handler";
import type { SchemaParser } from "./schema-parser";

export type DispatcherDeps = Readonly<{
  parser: SchemaParser;
}>;

export class Dispatcher {
  constructor(private readonly deps: DispatcherDeps) {}

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
          : entry.handler.handle({
              ...(current as Inbound<TActor>),
              input: this.deps.parser.parse(
                entry.handler.input ?? NO_INPUT,
                current.input,
              ),
            });
      };

    return step(0)(inbound);
  }
}
