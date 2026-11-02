import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";

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

type ResolvePermissions<S> = S extends {
  actor: { permissions: readonly (infer P)[] };
}
  ? readonly P[]
  : never;

type ResolveRoles<S> = S extends { actor: { role: infer R } }
  ? readonly R[]
  : never;

type ActorAccess = Readonly<{
  permissions?: readonly string[];
  role?: string;
}>;

export abstract class UseCase<S extends UseCaseShape = Record<string, never>> {
  /** Every code the actor must hold; checked before `execute` runs. */
  readonly permissions?: ResolvePermissions<S>;
  /** At least one code the actor must hold; checked after `permissions`. */
  readonly anyPermissions?: ResolvePermissions<S>;
  /** One of these roles the actor must have; checked after the permissions. */
  readonly roles?: ResolveRoles<S>;

  constructor(protected readonly deps: ResolveDeps<S>) {
    const prototype = Object.getPrototypeOf(this) as UseCase<S>;
    this.execute = async (...args: ExecuteArgs<S>) => {
      this.ensureAccess(args.at(-1) as ActorAccess | undefined);
      return await prototype.execute.apply(this, args);
    };
  }

  abstract execute(...args: ExecuteArgs<S>): Promise<ResolveOutput<S>>;

  private ensureAccess(actor: ActorAccess | undefined): void {
    const holds = (permission: string) =>
      actor?.permissions?.includes(permission) === true;

    const required = (this.permissions ?? []) as readonly string[];
    const missing = required.find((permission) => !holds(permission));
    if (missing !== undefined) {
      throw new AppError(SharedError.PermissionMissing, { required: missing });
    }

    const anyOf = (this.anyPermissions ?? []) as readonly string[];
    if (anyOf.length > 0 && !anyOf.some(holds)) {
      throw new AppError(SharedError.PermissionMissing, { anyOf });
    }

    const roles = (this.roles ?? []) as readonly string[];
    if (
      roles.length > 0 &&
      (actor?.role === undefined || !roles.includes(actor.role))
    ) {
      throw new AppError(SharedError.RoleMissing, { roles });
    }
  }
}
