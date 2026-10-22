import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";
import { toOutputAccount } from "../mappers/toOutputAccount";
import { toOutputMembership } from "../mappers/toOutputMembership";

import { GetMeDeps, GetMeOutput } from "./get-me.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";

export class GetMeUseCase extends UseCase<{
  output: GetMeOutput;
  deps: GetMeDeps;
  actor: Actor;
}> {
  async execute(actor: Actor): Promise<GetMeOutput> {
    const session = await this.deps.sessions.findById(actor.sessionId);
    // A session that belongs to someone else is treated as missing.
    if (!session || session.accountId.value !== actor.accountId) {
      throw new AppError(IdentityError.SessionNotFound, {
        sessionId: actor.sessionId,
      });
    }
    if (session.isRevoked()) {
      throw new AppError(IdentityError.SessionRevoked, {
        sessionId: session.id.value,
      });
    }
    if (session.isExpired(this.deps.clock.now())) {
      throw new AppError(IdentityError.SessionExpired, {
        sessionId: session.id.value,
      });
    }

    const account = await this.deps.accountResolver.resolveActive(
      actor.accountId,
    );
    const membership = await this.deps.membershipResolver.resolveActive(
      account.id.value,
    );

    return {
      account: toOutputAccount(account),
      membership: toOutputMembership(membership),
    };
  }
}
