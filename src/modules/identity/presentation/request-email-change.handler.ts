import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { PASSWORD_MAX_LENGTH } from "@/identity/application/password.policy";
import { RequestEmailChangeInput } from "@/identity/application/use-cases/request-email-change.types";
import { RequestEmailChangeUseCase } from "@/identity/application/use-cases/request-email-change.use-case";

const inputSchema = v.object<RequestEmailChangeInput>({
  newEmail: v.email(),
  password: v.string({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
});

export type RequestEmailChangeHandlerDeps = {
  requestEmailChange: RequestEmailChangeUseCase;
};

export class RequestEmailChangeHandler extends Handler<{
  deps: RequestEmailChangeHandlerDeps;
  actor: Actor;
  output: void;
}> {
  async handle(inbound: Inbound<Actor>): Promise<void> {
    const input = inputSchema.probe(inbound.input);
    await this.deps.requestEmailChange.execute(input, inbound.actor);
  }
}
