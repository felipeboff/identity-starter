import type { Logger } from "@shared/application/ports/logger";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { SessionRepository } from "../ports/session.repository";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

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
  transactions: TransactionRunner;
  logger: Logger;
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
    if (targets.length > 0) this.logRevoked(accountId, targets, revocation);

    return targets;
  }

  async revoke(session: Session, revocation: SessionRevocation): Promise<void> {
    session.revoke(revocation.reason, revocation.at, revocation.revokedBy);
    await this.deps.sessions.save(session);
    this.logRevoked(session.accountId.value, [session], revocation);
  }

  private logRevoked(
    accountId: string,
    sessions: Session[],
    revocation: SessionRevocation,
  ): void {
    const sessionIds = sessions.map((session) => session.id.value);
    this.deps.transactions.afterCommit(() =>
      this.deps.logger.info(IdentityUseCaseLogEvent.SessionsRevoked, {
        accountId,
        reason: revocation.reason,
        revokedBy: revocation.revokedBy ?? null,
        sessionIds,
      }),
    );
  }
}
