import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { toSessionOrigin } from "./mappers/toSessionOrigin";

import {
  SignUpWithEmailInput,
  SignUpWithEmailOutput,
} from "@/identity/application/use-cases/sign-up-with-email.types";
import { SignUpWithEmailUseCase } from "@/identity/application/use-cases/sign-up-with-email.use-case";

const inputSchema = v.object<
  Pick<SignUpWithEmailInput, "name" | "email" | "password">
>({
  name: v.string(),
  email: v.email(),
  password: v.string(),
});

export type SignUpWithEmailHandlerDeps = {
  signUpWithEmail: SignUpWithEmailUseCase;
};

export class SignUpWithEmailHandler extends Handler<{
  deps: SignUpWithEmailHandlerDeps;
  output: SignUpWithEmailOutput;
}> {
  async handle(inbound: Inbound): Promise<SignUpWithEmailOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.signUpWithEmail.execute({
      ...input,
      ...toSessionOrigin(inbound),
    });
  }
}
