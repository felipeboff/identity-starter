/**
 * Mini contract of a use case:
 * - `input`: what to do (omit when there is nothing to pass)
 * - `output`: what comes back (omit for `void`)
 * - `deps`: what it needs, injected through the constructor
 * - `actor`: who is doing it (omit for public use cases such as sign-up)
 */
export type UseCaseShape = Readonly<{
  input?: unknown;
  output?: unknown;
  deps?: unknown;
  actor?: unknown;
}>;

type ResolveOutput<S> = S extends { output: infer O } ? O : void;
type ResolveDeps<S> = S extends { deps: infer D } ? D : void;

/**
 * `execute` arguments follow the shape:
 * input + actor → (input, actor) · input only → (input) · actor only → (actor)
 */
type ExecuteArgs<S> = S extends { input: infer I }
  ? S extends { actor: infer A }
    ? [input: I, actor: A]
    : [input: I]
  : S extends { actor: infer A }
    ? [actor: A]
    : [];

export abstract class UseCase<S extends UseCaseShape = Record<string, never>> {
  constructor(protected readonly deps: ResolveDeps<S>) {}
  abstract execute(...args: ExecuteArgs<S>): Promise<ResolveOutput<S>>;
}
