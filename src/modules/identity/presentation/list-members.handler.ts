import { Handler, Inbound } from "@shared/presentation/handler";
import { pageRequestFields } from "@shared/presentation/page-request.schema";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { ListMembersOutput } from "@/identity/application/use-cases/list-members.types";
import { ListMembersUseCase } from "@/identity/application/use-cases/list-members.use-case";

const inputSchema = Type.Object(pageRequestFields);

type Input = Type.StaticDecode<typeof inputSchema>;

export type ListMembersHandlerDeps = {
  listMembers: ListMembersUseCase;
};

export class ListMembersHandler extends Handler<{
  deps: ListMembersHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: ListMembersOutput;
}> {
  readonly name = "identity.list_members";
  readonly input = inputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<ListMembersOutput> {
    return this.deps.listMembers.execute(inbound.input, inbound.actor);
  }
}
