import Type, { type StaticDecode, type TSchema } from "typebox";

export type Inbound<TActor = undefined, TInput = unknown> = Readonly<{
  /** HTTP params + query + body, MCP tool arguments or message payload. */
  input: TInput;
  metadata: Readonly<Record<string, string | undefined>>;
  ip: string;
  actor: TActor;
}>;

export const NO_INPUT = Type.Object({});

type ResolveDeps<S> = S extends { deps: infer D } ? D : void;
type ResolveActor<S> = S extends { actor: infer A } ? A : undefined;
type ResolveInput<S> = S extends { input: infer I extends TSchema }
  ? I
  : typeof NO_INPUT;

export type HandlerShape = Readonly<{
  deps?: unknown;
  actor?: unknown;
  input?: TSchema;
  output?: TSchema;
}>;

type ResolveOutputSchema<S> = S extends { output: infer O extends TSchema }
  ? O
  : never;
type ResolveOutput<S> = S extends { output: infer O extends TSchema }
  ? StaticDecode<O>
  : void;

export abstract class Handler<S extends HandlerShape = Record<string, never>> {
  constructor(protected readonly deps: ResolveDeps<S>) {}
  abstract readonly name: string;
  readonly input?: ResolveInput<S>;
  readonly output?: ResolveOutputSchema<S>;
  abstract handle(
    inbound: Inbound<ResolveActor<S>, StaticDecode<ResolveInput<S>>>,
  ): Promise<ResolveOutput<S>>;
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
  handler: Handler<{
    deps: unknown;
    actor: TActor;
    input: TSchema;
    output: TSchema;
  }>;
}>;
