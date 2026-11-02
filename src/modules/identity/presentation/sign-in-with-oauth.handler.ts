import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { codeVerifierSchema } from "./code-verifier";
import { toSessionOrigin } from "./mappers/toSessionOrigin";
import { signedInOutputFields } from "./output.schema";

import { SignInWithOAuthOutput } from "@/identity/application/use-cases/sign-in-with-oauth.types";
import { SignInWithOAuthUseCase } from "@/identity/application/use-cases/sign-in-with-oauth.use-case";

const inputSchema = Type.Object({
  provider: Type.String(),
  code: Type.String(),
  codeVerifier: codeVerifierSchema,
});

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object({
  ...signedInOutputFields,
  isNewAccount: Type.Boolean(),
});

export type SignInWithOAuthHandlerDeps = {
  signInWithOAuth: SignInWithOAuthUseCase;
};

export class SignInWithOAuthHandler extends Handler<{
  deps: SignInWithOAuthHandlerDeps;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.sign_in_with_oauth";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(
    inbound: Inbound<undefined, Input>,
  ): Promise<SignInWithOAuthOutput> {
    return this.deps.signInWithOAuth.execute({
      ...inbound.input,
      ...toSessionOrigin(inbound),
    });
  }
}
