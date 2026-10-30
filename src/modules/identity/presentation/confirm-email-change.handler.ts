import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import {
  ConfirmEmailChangeInput,
  ConfirmEmailChangeOutput,
} from "@/identity/application/use-cases/confirm-email-change.types";
import { ConfirmEmailChangeUseCase } from "@/identity/application/use-cases/confirm-email-change.use-case";

const inputSchema = v.object<ConfirmEmailChangeInput>({
  token: v.string({ minLength: 1 }),
});

export type ConfirmEmailChangeHandlerDeps = {
  confirmEmailChange: ConfirmEmailChangeUseCase;
};

export class ConfirmEmailChangeHandler extends Handler<{
  deps: ConfirmEmailChangeHandlerDeps;
  output: ConfirmEmailChangeOutput;
}> {
  async handle(inbound: Inbound): Promise<ConfirmEmailChangeOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.confirmEmailChange.execute(input);
  }
}
