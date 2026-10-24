import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { toSessionOrigin } from "./mappers/toSessionOrigin";

import {
  SignInWithOAuthInput,
  SignInWithOAuthOutput,
} from "@/identity/application/use-cases/sign-in-with-oauth.types";
import { SignInWithOAuthUseCase } from "@/identity/application/use-cases/sign-in-with-oauth.use-case";

const inputSchema = v.object<Pick<SignInWithOAuthInput, "provider" | "code">>({
  provider: v.string(),
  code: v.string(),
});

export type SignInWithOAuthHandlerDeps = {
  signInWithOAuth: SignInWithOAuthUseCase;
};

export class SignInWithOAuthHandler extends Handler<{
  deps: SignInWithOAuthHandlerDeps;
  output: SignInWithOAuthOutput;
}> {
  async handle(inbound: Inbound): Promise<SignInWithOAuthOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.signInWithOAuth.execute({
      ...input,
      ...toSessionOrigin(inbound),
    });
  }
}
