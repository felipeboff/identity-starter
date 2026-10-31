import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { codeVerifierSchema } from "./code-verifier";

import { Actor } from "@/identity/application/actor";
import { LinkOAuthOutput } from "@/identity/application/use-cases/link-oauth.types";
import { LinkOAuthUseCase } from "@/identity/application/use-cases/link-oauth.use-case";

const inputSchema = Type.Object({
  provider: Type.String(),
  code: Type.String(),
  codeVerifier: codeVerifierSchema,
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type LinkOAuthHandlerDeps = {
  linkOAuth: LinkOAuthUseCase;
};

export class LinkOAuthHandler extends Handler<{
  deps: LinkOAuthHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: LinkOAuthOutput;
}> {
  readonly name = "identity.link_oauth";
  readonly input = inputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<LinkOAuthOutput> {
    return this.deps.linkOAuth.execute(inbound.input, inbound.actor);
  }
}
