import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { toSessionOrigin } from "./mappers/toSessionOrigin";

import { PASSWORD_MAX_LENGTH } from "@/identity/application/password.policy";
import {
  SignInWithEmailInput,
  SignInWithEmailOutput,
} from "@/identity/application/use-cases/sign-in-with-email.types";
import { SignInWithEmailUseCase } from "@/identity/application/use-cases/sign-in-with-email.use-case";

const inputSchema = v.object<Pick<SignInWithEmailInput, "email" | "password">>({
  email: v.email(),
  password: v.string({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
});

export type SignInWithEmailHandlerDeps = {
  signInWithEmail: SignInWithEmailUseCase;
};

export class SignInWithEmailHandler extends Handler<{
  deps: SignInWithEmailHandlerDeps;
  output: SignInWithEmailOutput;
}> {
  async handle(inbound: Inbound): Promise<SignInWithEmailOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.signInWithEmail.execute({
      ...input,
      ...toSessionOrigin(inbound),
    });
  }
}
