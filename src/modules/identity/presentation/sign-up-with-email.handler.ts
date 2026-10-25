import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { toSessionOrigin } from "./mappers/toSessionOrigin";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
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
  password: v.string({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  }),
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
