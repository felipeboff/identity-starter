import { Handler, Inbound } from "@shared/presentation/handler";
import { pageRequestFields } from "@shared/presentation/page-request.schema";
import Type from "typebox";

import { accountOutputSchema, membershipOutputSchema } from "./output.schema";

import { Actor } from "@/identity/application/actor";
import { ListMembersOutput } from "@/identity/application/use-cases/list-members.types";
import { ListMembersUseCase } from "@/identity/application/use-cases/list-members.use-case";

const inputSchema = Type.Object(pageRequestFields);

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object({
  members: Type.Array(
    Type.Object({
      account: accountOutputSchema,
      membership: membershipOutputSchema,
    }),
  ),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export type ListMembersHandlerDeps = {
  listMembers: ListMembersUseCase;
};

export class ListMembersHandler extends Handler<{
  deps: ListMembersHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.list_members";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<ListMembersOutput> {
    return this.deps.listMembers.execute(inbound.input, inbound.actor);
  }
}
