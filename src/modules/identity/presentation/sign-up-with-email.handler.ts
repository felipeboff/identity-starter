import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { toSessionOrigin } from "./mappers/toSessionOrigin";
import { signedInOutputFields } from "./output.schema";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
import { SignUpWithEmailOutput } from "@/identity/application/use-cases/sign-up-with-email.types";
import { SignUpWithEmailUseCase } from "@/identity/application/use-cases/sign-up-with-email.use-case";

const inputSchema = Type.Object({
  name: Type.String(),
  email: Type.String({ format: "email" }),
  password: Type.String({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object(signedInOutputFields);

export type SignUpWithEmailHandlerDeps = {
  signUpWithEmail: SignUpWithEmailUseCase;
};

export class SignUpWithEmailHandler extends Handler<{
  deps: SignUpWithEmailHandlerDeps;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.sign_up_with_email";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(
    inbound: Inbound<undefined, Input>,
  ): Promise<SignUpWithEmailOutput> {
    return this.deps.signUpWithEmail.execute({
      ...inbound.input,
      ...toSessionOrigin(inbound),
    });
  }
}
