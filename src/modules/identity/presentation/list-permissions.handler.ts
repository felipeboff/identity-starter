import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { permissionsSchema } from "./permissions.schema";

import { Actor } from "@/identity/application/actor";
import { ListPermissionsOutput } from "@/identity/application/use-cases/list-permissions.types";
import { ListPermissionsUseCase } from "@/identity/application/use-cases/list-permissions.use-case";

const outputSchema = Type.Object({ permissions: permissionsSchema });

export type ListPermissionsHandlerDeps = {
  listPermissions: ListPermissionsUseCase;
};

export class ListPermissionsHandler extends Handler<{
  deps: ListPermissionsHandlerDeps;
  actor: Actor;
  output: typeof outputSchema;
}> {
  readonly name = "identity.list_permissions";
  readonly output = outputSchema;

  async handle(inbound: Inbound<Actor>): Promise<ListPermissionsOutput> {
    return this.deps.listPermissions.execute(inbound.actor);
  }
}
