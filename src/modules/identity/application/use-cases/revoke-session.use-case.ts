import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import { RevokeSessionDeps, RevokeSessionInput } from "./revoke-session.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

/** Revokes one session as `SECURITY`. Allowed for its owner or an admin. */
export class RevokeSessionUseCase extends UseCase<{
  input: RevokeSessionInput;
  deps: RevokeSessionDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  async execute(input: RevokeSessionInput, actor: Actor): Promise<void> {
    const session = await this.deps.sessions.findById(input.sessionId);
    if (!session) {
      throw new AppError(IdentityError.SessionNotFound, {
        sessionId: input.sessionId,
      });
    }

    this.deps.accessPolicy.ensureCanManageAccount(
      actor,
      session.accountId.value,
      IdentityPermission.SESSION_REVOKE,
    );

    await this.deps.sessionRevoker.revoke(session, {
      reason: SessionRevocationReason.SECURITY,
      at: this.deps.clock.now(),
      revokedBy: actor.accountId,
    });
  }
}
