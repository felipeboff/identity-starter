import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { codeVerifierSchema } from "./code-verifier";
import { toSessionOrigin } from "./mappers/toSessionOrigin";

import { SignInWithOAuthOutput } from "@/identity/application/use-cases/sign-in-with-oauth.types";
import { SignInWithOAuthUseCase } from "@/identity/application/use-cases/sign-in-with-oauth.use-case";

const inputSchema = Type.Object({
  provider: Type.String(),
  code: Type.String(),
  codeVerifier: codeVerifierSchema,
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type SignInWithOAuthHandlerDeps = {
  signInWithOAuth: SignInWithOAuthUseCase;
};

export class SignInWithOAuthHandler extends Handler<{
  deps: SignInWithOAuthHandlerDeps;
  input: typeof inputSchema;
  output: SignInWithOAuthOutput;
}> {
  readonly name = "identity.sign_in_with_oauth";
  readonly input = inputSchema;

  async handle(
    inbound: Inbound<undefined, Input>,
  ): Promise<SignInWithOAuthOutput> {
    return this.deps.signInWithOAuth.execute({
      ...inbound.input,
      ...toSessionOrigin(inbound),
    });
  }
}
