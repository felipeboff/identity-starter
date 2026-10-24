import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { RequestPasswordResetInput } from "@/identity/application/use-cases/request-password-reset.types";
import { RequestPasswordResetUseCase } from "@/identity/application/use-cases/request-password-reset.use-case";

const inputSchema = v.object<RequestPasswordResetInput>({
  email: v.email(),
});

export type RequestPasswordResetHandlerDeps = {
  requestPasswordReset: RequestPasswordResetUseCase;
};

export class RequestPasswordResetHandler extends Handler<{
  deps: RequestPasswordResetHandlerDeps;
  output: void;
}> {
  async handle(inbound: Inbound): Promise<void> {
    const input = inputSchema.probe(inbound.input);
    await this.deps.requestPasswordReset.execute(input);
  }
}
