import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { toSessionOrigin } from "./mappers/toSessionOrigin";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/identity/application/password.policy";
import {
  AcceptInvitationInput,
  AcceptInvitationOutput,
} from "@/identity/application/use-cases/accept-invitation.types";
import { AcceptInvitationUseCase } from "@/identity/application/use-cases/accept-invitation.use-case";

const inputSchema = v.object<
  Pick<AcceptInvitationInput, "token" | "name" | "password">
>({
  token: v.string({ minLength: 1 }),
  name: v.string(),
  password: v.string({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  }),
});

export type AcceptInvitationHandlerDeps = {
  acceptInvitation: AcceptInvitationUseCase;
};

export class AcceptInvitationHandler extends Handler<{
  deps: AcceptInvitationHandlerDeps;
  output: AcceptInvitationOutput;
}> {
  async handle(inbound: Inbound): Promise<AcceptInvitationOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.acceptInvitation.execute({
      ...input,
      ...toSessionOrigin(inbound),
    });
  }
}
