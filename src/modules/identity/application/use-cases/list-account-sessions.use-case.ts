import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toPublicSession } from "../mappers/toPublicSession";

import {
  ListAccountSessionsDeps,
  ListAccountSessionsInput,
  ListAccountSessionsOutput,
} from "./list-account-sessions.types";

import { MembershipPermission } from "@/identity/domain/membership.entity";

export class ListAccountSessionsUseCase extends UseCase<{
  input: ListAccountSessionsInput;
  output: ListAccountSessionsOutput;
  deps: ListAccountSessionsDeps;
  actor: Actor;
}> {
  async execute(
    input: ListAccountSessionsInput,
    actor: Actor,
  ): Promise<ListAccountSessionsOutput> {
    this.deps.accessPolicy.ensureCanManageAccount(
      actor,
      input.accountId,
      MembershipPermission.SESSION_READ,
    );

    const at = this.deps.clock.now();
    const sessions = await this.deps.sessions.listByAccountId(input.accountId);

    return {
      sessions: sessions
        .filter((session) => session.isActive(at))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((session) => ({
          ...toPublicSession(session),
          current: session.id.value === actor.sessionId,
        })),
    };
  }
}
