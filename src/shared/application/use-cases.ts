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

export const Access = {
  ANYONE: "anyone",
  MEMBER: "member",
} as const;

type PermissionOf<A> = A extends { permissions: readonly (infer P)[] }
  ? P
  : never;
type RoleOf<A> = A extends { role: infer R } ? R : never;

type Requirement<P, R> =
  | Readonly<{
      permissions: readonly P[];
      anyPermissions?: readonly P[];
      roles?: readonly R[];
    }>
  | Readonly<{
      permissions?: readonly P[];
      anyPermissions: readonly P[];
      roles?: readonly R[];
    }>
  | Readonly<{
      permissions?: readonly P[];
      anyPermissions?: readonly P[];
      roles: readonly R[];
    }>;

type ResolveAccess<S> = S extends { actor: infer A }
  ? typeof Access.MEMBER | Requirement<PermissionOf<A>, RoleOf<A>>
  : typeof Access.ANYONE;

type AccessRule =
  | typeof Access.ANYONE
  | typeof Access.MEMBER
  | Readonly<{
      permissions?: readonly string[];
      anyPermissions?: readonly string[];
      roles?: readonly string[];
    }>;

type ActorAccess = Readonly<{
  permissions?: readonly string[];
  role?: string;
}>;

export abstract class UseCase<S extends UseCaseShape = Record<string, never>> {
  /**
   * Who may run it, checked before `execute`: `Access.ANYONE` without an actor,
   * `Access.MEMBER` for any actor, or every `permissions`, one of
   * `anyPermissions` and one of `roles`, in that order.
   */
  abstract readonly access: ResolveAccess<S>;

  constructor(protected readonly deps: ResolveDeps<S>) {
    const prototype = Object.getPrototypeOf(this) as UseCase<S>;
    this.execute = async (...args: ExecuteArgs<S>) => {
      this.ensureAccess(args.at(-1) as ActorAccess | undefined);
      return await prototype.execute.apply(this, args);
    };
  }

  abstract execute(...args: ExecuteArgs<S>): Promise<ResolveOutput<S>>;

  private ensureAccess(actor: ActorAccess | undefined): void {
    const access = this.access as AccessRule;
    if (access === Access.ANYONE || access === Access.MEMBER) return;

    const holds = (permission: string) =>
      actor?.permissions?.includes(permission) === true;

    const required = access.permissions ?? [];
    const missing = required.find((permission) => !holds(permission));
    if (missing !== undefined) {
      throw new AppError(SharedError.PermissionMissing, { required: missing });
    }

    const anyOf = access.anyPermissions ?? [];
    if (anyOf.length > 0 && !anyOf.some(holds)) {
      throw new AppError(SharedError.PermissionMissing, { anyOf });
    }

    const roles = access.roles ?? [];
    if (
      roles.length > 0 &&
      (actor?.role === undefined || !roles.includes(actor.role))
    ) {
      throw new AppError(SharedError.RoleMissing, { roles });
    }
  }
}
