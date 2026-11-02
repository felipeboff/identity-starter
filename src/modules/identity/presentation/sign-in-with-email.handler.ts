import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { toSessionOrigin } from "./mappers/toSessionOrigin";
import { signedInOutputFields } from "./output.schema";

import { PASSWORD_MAX_LENGTH } from "@/identity/application/password.policy";
import { SignInWithEmailOutput } from "@/identity/application/use-cases/sign-in-with-email.types";
import { SignInWithEmailUseCase } from "@/identity/application/use-cases/sign-in-with-email.use-case";

const inputSchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object(signedInOutputFields);

export type SignInWithEmailHandlerDeps = {
  signInWithEmail: SignInWithEmailUseCase;
};

export class SignInWithEmailHandler extends Handler<{
  deps: SignInWithEmailHandlerDeps;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.sign_in_with_email";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(
    inbound: Inbound<undefined, Input>,
  ): Promise<SignInWithEmailOutput> {
    return this.deps.signInWithEmail.execute({
      ...inbound.input,
      ...toSessionOrigin(inbound),
    });
  }
}
