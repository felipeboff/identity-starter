import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import {
  LinkOAuthInput,
  LinkOAuthOutput,
} from "@/identity/application/use-cases/link-oauth.types";
import { LinkOAuthUseCase } from "@/identity/application/use-cases/link-oauth.use-case";

const inputSchema = v.object<LinkOAuthInput>({
  provider: v.string(),
  code: v.string(),
});

export type LinkOAuthHandlerDeps = {
  linkOAuth: LinkOAuthUseCase;
};

export class LinkOAuthHandler extends Handler<{
  deps: LinkOAuthHandlerDeps;
  actor: Actor;
  output: LinkOAuthOutput;
}> {
  async handle(inbound: Inbound<Actor>): Promise<LinkOAuthOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.linkOAuth.execute(input, inbound.actor);
  }
}
