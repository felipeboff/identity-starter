import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
import { ResetPasswordInput } from "@/identity/application/use-cases/reset-password.types";
import { ResetPasswordUseCase } from "@/identity/application/use-cases/reset-password.use-case";

const inputSchema = v.object<ResetPasswordInput>({
  token: v.string(),
  newPassword: v.string({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  }),
});

export type ResetPasswordHandlerDeps = {
  resetPassword: ResetPasswordUseCase;
};

export class ResetPasswordHandler extends Handler<{
  deps: ResetPasswordHandlerDeps;
  output: void;
}> {
  async handle(inbound: Inbound): Promise<void> {
    const input = inputSchema.probe(inbound.input);
    await this.deps.resetPassword.execute(input);
  }
}
