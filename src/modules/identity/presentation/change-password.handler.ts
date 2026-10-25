import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
import { ChangePasswordInput } from "@/identity/application/use-cases/change-password.types";
import { ChangePasswordUseCase } from "@/identity/application/use-cases/change-password.use-case";

const inputSchema = v.object<ChangePasswordInput>({
  oldPassword: v.string({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
  newPassword: v.string({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  }),
});

export type ChangePasswordHandlerDeps = {
  changePassword: ChangePasswordUseCase;
};

export class ChangePasswordHandler extends Handler<{
  deps: ChangePasswordHandlerDeps;
  actor: Actor;
  output: void;
}> {
  async handle(inbound: Inbound<Actor>): Promise<void> {
    const input = inputSchema.probe(inbound.input);
    await this.deps.changePassword.execute(input, inbound.actor);
  }
}
