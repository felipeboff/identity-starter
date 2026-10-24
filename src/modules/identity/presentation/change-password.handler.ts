import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { ChangePasswordInput } from "@/identity/application/use-cases/change-password.types";
import { ChangePasswordUseCase } from "@/identity/application/use-cases/change-password.use-case";

const inputSchema = v.object<ChangePasswordInput>({
  oldPassword: v.string({ minLength: 8 }),
  newPassword: v.string({ minLength: 8 }),
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
