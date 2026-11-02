import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import { SignOutDeps, SignOutOutput } from "./sign-out.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

export class SignOutUseCase extends UseCase<{
  output: SignOutOutput;
  deps: SignOutDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  async execute(actor: Actor): Promise<SignOutOutput> {
    const session = await this.deps.sessions.findById(actor.sessionId);
    if (!session) {
      throw new AppError(IdentityError.SessionNotFound, {
        sessionId: actor.sessionId,
      });
    }

    await this.deps.sessionRevoker.revoke(session, {
      reason: SessionRevocationReason.LOGOUT,
      at: this.deps.clock.now(),
    });
  }
}
