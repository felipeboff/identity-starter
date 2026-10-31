import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { toSessionOrigin } from "./mappers/toSessionOrigin";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
import { AcceptInvitationOutput } from "@/identity/application/use-cases/accept-invitation.types";
import { AcceptInvitationUseCase } from "@/identity/application/use-cases/accept-invitation.use-case";

const inputSchema = Type.Object({
  token: Type.String({ minLength: 1 }),
  name: Type.String(),
  password: Type.String({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  }),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type AcceptInvitationHandlerDeps = {
  acceptInvitation: AcceptInvitationUseCase;
};

export class AcceptInvitationHandler extends Handler<{
  deps: AcceptInvitationHandlerDeps;
  input: typeof inputSchema;
  output: AcceptInvitationOutput;
}> {
  readonly name = "identity.accept_invitation";
  readonly input = inputSchema;

  async handle(
    inbound: Inbound<undefined, Input>,
  ): Promise<AcceptInvitationOutput> {
    return this.deps.acceptInvitation.execute({
      ...inbound.input,
      ...toSessionOrigin(inbound),
    });
  }
}
