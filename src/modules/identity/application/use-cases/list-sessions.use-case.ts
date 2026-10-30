import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toPublicSession } from "../mappers/toPublicSession";

import { ListSessionsDeps, ListSessionsOutput } from "./list-sessions.types";

export class ListSessionsUseCase extends UseCase<{
  output: ListSessionsOutput;
  deps: ListSessionsDeps;
  actor: Actor;
}> {
  async execute(actor: Actor): Promise<ListSessionsOutput> {
    const at = this.deps.clock.now();
    const sessions = await this.deps.sessions.listByAccountId(actor.accountId);

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
