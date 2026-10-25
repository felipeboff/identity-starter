import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";

import {
  RevokeAllSessionsDeps,
  RevokeAllSessionsInput,
  RevokeAllSessionsOutput,
} from "./revoke-all-sessions.types";

import { SessionRevocationReason } from "@/identity/domain/session.entity";

/** Revokes every active session of an account as `SECURITY`. */
export class RevokeAllSessionsUseCase extends UseCase<{
  input: RevokeAllSessionsInput;
  output: RevokeAllSessionsOutput;
  deps: RevokeAllSessionsDeps;
  actor: Actor;
}> {
  async execute(
    input: RevokeAllSessionsInput,
    actor: Actor,
  ): Promise<RevokeAllSessionsOutput> {
    return this.deps.transactions.run(async () => {
      this.deps.accessPolicy.ensureCanManageAccount(actor, input.accountId);

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
