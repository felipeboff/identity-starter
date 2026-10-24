import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { UnlinkOAuthInput } from "@/identity/application/use-cases/unlink-oauth.types";
import { UnlinkOAuthUseCase } from "@/identity/application/use-cases/unlink-oauth.use-case";

const inputSchema = v.object<UnlinkOAuthInput>({
  provider: v.string(),
});

export type UnlinkOAuthHandlerDeps = {
  unlinkOAuth: UnlinkOAuthUseCase;
};

export class UnlinkOAuthHandler extends Handler<{
  deps: UnlinkOAuthHandlerDeps;
  actor: Actor;
  output: void;
}> {
  async handle(inbound: Inbound<Actor>): Promise<void> {
    const input = inputSchema.probe(inbound.input);
    await this.deps.unlinkOAuth.execute(input, inbound.actor);
  }
}
