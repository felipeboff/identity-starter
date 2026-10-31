import { Handler, Inbound } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { RequestEmailVerificationUseCase } from "@/identity/application/use-cases/request-email-verification.use-case";

export type RequestEmailVerificationHandlerDeps = {
  requestEmailVerification: RequestEmailVerificationUseCase;
};

export class RequestEmailVerificationHandler extends Handler<{
  deps: RequestEmailVerificationHandlerDeps;
  actor: Actor;
  output: void;
}> {
  readonly name = "identity.request_email_verification";

  async handle(inbound: Inbound<Actor>): Promise<void> {
    await this.deps.requestEmailVerification.execute(inbound.actor);
  }
}
