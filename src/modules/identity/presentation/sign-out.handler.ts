import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { SignOutUseCase } from "@/identity/application/use-cases/sign-out.use-case";

export type SignOutHandlerDeps = {
  signOut: SignOutUseCase;
};

export class SignOutHandler extends Handler<{
  deps: SignOutHandlerDeps;
  actor: Actor;
  output: void;
}> {
  async handle(inbound: Inbound<Actor>): Promise<void> {
    await this.deps.signOut.execute(inbound.actor);
  }
}
