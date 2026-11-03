import { Access, UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";

import {
  ListPermissionsDeps,
  ListPermissionsOutput,
} from "./list-permissions.types";

export class ListPermissionsUseCase extends UseCase<{
  output: ListPermissionsOutput;
  deps: ListPermissionsDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  execute(_actor: Actor): Promise<ListPermissionsOutput> {
    return Promise.resolve({ permissions: this.deps.permissions.all() });
  }
}
