import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { UnlinkOAuthUseCase } from "@/identity/application/use-cases/unlink-oauth.use-case";

const inputSchema = Type.Object({
  provider: Type.String(),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type UnlinkOAuthHandlerDeps = {
  unlinkOAuth: UnlinkOAuthUseCase;
};

export class UnlinkOAuthHandler extends Handler<{
  deps: UnlinkOAuthHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
}> {
  readonly name = "identity.unlink_oauth";
  readonly input = inputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<void> {
    await this.deps.unlinkOAuth.execute(inbound.input, inbound.actor);
  }
}
