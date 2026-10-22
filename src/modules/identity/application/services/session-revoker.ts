import { SessionRepository } from "../ports/session.repository";

import {
  Session,
  SessionRevocationReason,
} from "@/identity/domain/session.entity";

export type SessionRevocation = {
  reason: SessionRevocationReason;
  at: Date;
  revokedBy?: string;
  where?: (session: Session) => boolean;
};

type SessionRevokerDeps = {
  sessions: SessionRepository;
};

export class SessionRevoker {
  constructor(private readonly deps: SessionRevokerDeps) {}

  /** Revokes every active session of the account (optionally narrowed by `where`). */
  async revokeActive(
    accountId: string,
    revocation: SessionRevocation,
  ): Promise<Session[]> {
    const { reason, at, revokedBy, where = () => true } = revocation;

    const targets = (
      await this.deps.sessions.listByAccountId(accountId)
    ).filter((session) => session.isActive(at) && where(session));

    for (const session of targets) {
      session.revoke(reason, at, revokedBy);
      await this.deps.sessions.save(session);
    }

    return targets;
  }
}
