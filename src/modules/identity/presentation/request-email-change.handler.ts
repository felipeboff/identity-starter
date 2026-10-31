import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { Actor } from "@/identity/application/actor";
import { PASSWORD_MAX_LENGTH } from "@/identity/application/password.policy";
import { RequestEmailChangeUseCase } from "@/identity/application/use-cases/request-email-change.use-case";

const inputSchema = Type.Object({
  newEmail: Type.String({ format: "email" }),
  password: Type.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type RequestEmailChangeHandlerDeps = {
  requestEmailChange: RequestEmailChangeUseCase;
};

export class RequestEmailChangeHandler extends Handler<{
  deps: RequestEmailChangeHandlerDeps;
  actor: Actor;
  input: typeof inputSchema;
  output: void;
}> {
  readonly name = "identity.request_email_change";
  readonly input = inputSchema;

  async handle(inbound: Inbound<Actor, Input>): Promise<void> {
    await this.deps.requestEmailChange.execute(inbound.input, inbound.actor);
  }
}
