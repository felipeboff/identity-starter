import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
import { ChangePasswordUseCase } from "@/identity/application/use-cases/change-password.use-case";

const inputSchema = Type.Object({
  oldPassword: Type.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
  newPassword: Type.String({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type ChangePasswordHandlerDeps = {
  changePassword: ChangePasswordUseCase;
};

export class ChangePasswordHandler extends Handler<{
  deps: ChangePasswordHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: void;
}> {
  readonly name = "identity.change_password";
  readonly input = inputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<void> {
    await this.deps.changePassword.execute(inbound.input, inbound.actor);
  }
}
