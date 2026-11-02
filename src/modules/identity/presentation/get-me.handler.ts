import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { accountOutputSchema, membershipOutputSchema } from "./output.schema";

import { Actor } from "@/identity/application/actor";
import { GetMeOutput } from "@/identity/application/use-cases/get-me.types";
import { GetMeUseCase } from "@/identity/application/use-cases/get-me.use-case";

const outputSchema = Type.Object({
  account: accountOutputSchema,
  membership: membershipOutputSchema,
});

export type GetMeHandlerDeps = {
  getMe: GetMeUseCase;
};

export class GetMeHandler extends Handler<{
  deps: GetMeHandlerDeps;
  actor: Actor;
  output: typeof outputSchema;
}> {
  readonly name = "identity.get_me";
  readonly output = outputSchema;

  async handle(inbound: Inbound<Actor>): Promise<GetMeOutput> {
    return this.deps.getMe.execute(inbound.actor);
  }
}
