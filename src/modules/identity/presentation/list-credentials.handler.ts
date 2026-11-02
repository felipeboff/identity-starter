import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { credentialOutputSchema } from "./output.schema";

import { Actor } from "@/identity/application/actor";
import { ListCredentialsOutput } from "@/identity/application/use-cases/list-credentials.types";
import { ListCredentialsUseCase } from "@/identity/application/use-cases/list-credentials.use-case";

const outputSchema = Type.Object({
  credentials: Type.Array(credentialOutputSchema),
});

export type ListCredentialsHandlerDeps = {
  listCredentials: ListCredentialsUseCase;
};

export class ListCredentialsHandler extends Handler<{
  deps: ListCredentialsHandlerDeps;
  actor: Actor;
  output: typeof outputSchema;
}> {
  readonly name = "identity.list_credentials";
  readonly output = outputSchema;

  async handle(inbound: Inbound<Actor>): Promise<ListCredentialsOutput> {
    return this.deps.listCredentials.execute(inbound.actor);
  }
}
