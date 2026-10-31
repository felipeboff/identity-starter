import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
import { ResetPasswordUseCase } from "@/identity/application/use-cases/reset-password.use-case";

const inputSchema = Type.Object({
  token: Type.String(),
  newPassword: Type.String({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type ResetPasswordHandlerDeps = {
  resetPassword: ResetPasswordUseCase;
};

export class ResetPasswordHandler extends Handler<{
  deps: ResetPasswordHandlerDeps;
  input: typeof inputSchema;
  output: void;
}> {
  readonly name = "identity.reset_password";
  readonly input = inputSchema;

  async handle(inbound: Inbound<undefined, Input>): Promise<void> {
    await this.deps.resetPassword.execute(inbound.input);
  }
}
