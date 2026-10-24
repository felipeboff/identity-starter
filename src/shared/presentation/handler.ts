export type Inbound<TActor = undefined> = Readonly<{
  /** HTTP params + query + body, MCP tool arguments or message payload. */
  input: unknown;
  metadata: Readonly<Record<string, string | undefined>>;
  ip: string;
  actor: TActor;
}>;

type ResolveDeps<S> = S extends { deps: infer D } ? D : void;
type ResolveActor<S> = S extends { actor: infer A } ? A : undefined;

export type HandlerShape = Readonly<{
  deps?: unknown;
  actor?: unknown;
  output?: unknown;
}>;

type ResolveOutput<S> = S extends { output: infer O } ? O : unknown;

export abstract class Handler<S extends HandlerShape = Record<string, never>> {
  constructor(protected readonly deps: ResolveDeps<S>) {}
  abstract handle(inbound: Inbound<ResolveActor<S>>): Promise<ResolveOutput<S>>;
}

export type Next<TActor = undefined> = (
  inbound: Inbound<TActor>,
) => Promise<unknown>;

export type MiddlewareShape = Readonly<{
  deps?: unknown;
  actor?: unknown;
  nextActor?: unknown;
}>;

type ResolveNextActor<S> = S extends { nextActor: infer A }
  ? A
  : ResolveActor<S>;

export abstract class Middleware<
  S extends MiddlewareShape = Record<string, never>,
> {
  constructor(protected readonly deps: ResolveDeps<S>) {}
  abstract handle(
    inbound: Inbound<ResolveActor<S>>,
    next: Next<ResolveNextActor<S>>,
  ): Promise<unknown>;
}

export type Entry<TActor = undefined> = Readonly<{
  middlewares?: readonly Middleware<{
    deps: unknown;
    actor: never;
    nextActor: unknown;
  }>[];
  handler: Handler<{ deps: unknown; actor: TActor; output: unknown }>;
}>;
