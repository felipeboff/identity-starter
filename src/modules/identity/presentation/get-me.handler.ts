import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { GetMeOutput } from "@/identity/application/use-cases/get-me.types";
import { GetMeUseCase } from "@/identity/application/use-cases/get-me.use-case";

export type GetMeHandlerDeps = {
  getMe: GetMeUseCase;
};

export class GetMeHandler extends Handler<{
  deps: GetMeHandlerDeps;
  actor: Actor;
  output: GetMeOutput;
}> {
  readonly name = "identity.get_me";

  async handle(inbound: Inbound<Actor>): Promise<GetMeOutput> {
    return this.deps.getMe.execute(inbound.actor);
  }
}
