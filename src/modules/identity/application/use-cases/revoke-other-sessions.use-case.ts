import { Access, UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";

import {
  RevokeOtherSessionsDeps,
  RevokeOtherSessionsOutput,
} from "./revoke-other-sessions.types";

import { SessionRevocationReason } from "@/identity/domain/session.entity";

export class RevokeOtherSessionsUseCase extends UseCase<{
  output: RevokeOtherSessionsOutput;
  deps: RevokeOtherSessionsDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  async execute(actor: Actor): Promise<RevokeOtherSessionsOutput> {
    return this.deps.transactions.run(async () => {
      const revoked = await this.deps.sessionRevoker.revokeActive(
        actor.accountId,
        {
          reason: SessionRevocationReason.SECURITY,
          at: this.deps.clock.now(),
          revokedBy: actor.accountId,
          where: (session) => session.id.value !== actor.sessionId,
        },
      );

      return { revokedCount: revoked.length };
    });
  }
}
