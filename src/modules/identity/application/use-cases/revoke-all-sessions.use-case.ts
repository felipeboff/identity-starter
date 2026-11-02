import { Access, UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";

import {
  RevokeAllSessionsDeps,
  RevokeAllSessionsInput,
  RevokeAllSessionsOutput,
} from "./revoke-all-sessions.types";

import { MembershipPermission } from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

/** Revokes every active session of an account as `SECURITY`. */
export class RevokeAllSessionsUseCase extends UseCase<{
  input: RevokeAllSessionsInput;
  output: RevokeAllSessionsOutput;
  deps: RevokeAllSessionsDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  async execute(
    input: RevokeAllSessionsInput,
    actor: Actor,
  ): Promise<RevokeAllSessionsOutput> {
    return this.deps.transactions.run(async () => {
      this.deps.accessPolicy.ensureCanManageAccount(
        actor,
        input.accountId,
        MembershipPermission.SESSION_REVOKE_ALL,
      );

      const revoked = await this.deps.sessionRevoker.revokeActive(
        input.accountId,
        {
          reason: SessionRevocationReason.SECURITY,
          at: this.deps.clock.now(),
          revokedBy: actor.accountId,
        },
      );

      return { revokedCount: revoked.length };
    });
  }
}
