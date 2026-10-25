import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { IdentitySecurityLogEvent } from "../identity-security.log-event";
import { toOutputAccount } from "../mappers/toOutputAccount";
import { IssuedSession } from "../services/session-issuer";

import {
  RefreshSessionDeps,
  RefreshSessionInput,
  RefreshSessionOutput,
} from "./refresh-session.types";

import { Account } from "@/identity/domain/account.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  Session,
  SessionRevocationReason,
} from "@/identity/domain/session.entity";

type Refresh =
  | Readonly<{ reused: false; account: Account; issued: IssuedSession }>
  | Readonly<{ reused: true; session: Session; revokedSessions: number }>;

export class RefreshSessionUseCase extends UseCase<{
  input: RefreshSessionInput;
  output: RefreshSessionOutput;
  deps: RefreshSessionDeps;
}> {
  async execute(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    const refreshed = await this.deps.transactions.run<Refresh>(async () => {
      const at = this.deps.clock.now();
      const currentSession = await this.deps.sessions.findByTokenHash(
        this.deps.tokens.hash(input.refreshToken),
      );
      if (!currentSession) {
        throw new AppError(IdentityError.InvalidRefreshToken);
      }
      if (currentSession.revokedReason === SessionRevocationReason.REPLACED) {
        const revoked = await this.deps.sessionRevoker.revokeActive(
          currentSession.accountId.value,
          { reason: SessionRevocationReason.SECURITY, at },
        );
        return {
          reused: true,
          session: currentSession,
          revokedSessions: revoked.length,
        };
      }
      if (currentSession.isRevoked()) {
        throw new AppError(IdentityError.SessionRevoked, {
          sessionId: currentSession.id.value,
        });
      }
      if (currentSession.isExpired(at)) {
        throw new AppError(IdentityError.SessionExpired, {
          sessionId: currentSession.id.value,
        });
      }

      const account = await this.deps.accounts.findById(
        currentSession.accountId.value,
      );
      if (!account) {
        throw new AppError(IdentityError.AccountNotFound, {
          accountId: currentSession.accountId.value,
        });
      }
      if (account.isDeleted()) {
        throw new AppError(IdentityError.AccountDeleted, {
          accountId: account.id.value,
        });
      }

      const credential = await this.deps.credentials.findById(
        currentSession.credentialId.value,
      );
      if (!credential) {
        throw new AppError(IdentityError.CredentialNotFound, {
          credentialId: currentSession.credentialId.value,
        });
      }
      if (credential.isDeleted()) {
        throw new AppError(IdentityError.CredentialDeleted, {
          credentialId: credential.id.value,
        });
      }

      const membership = await this.deps.memberships.findById(
        currentSession.membershipId.value,
      );
      if (!membership) {
        throw new AppError(IdentityError.MembershipNotFound, {
          accountId: currentSession.accountId.value,
        });
      }
      if (membership.isDeleted()) {
        throw new AppError(IdentityError.MembershipDeleted, {
          membershipId: membership.id.value,
        });
      }

      account.markAsLastSeen(at);
      currentSession.revoke(
        SessionRevocationReason.REPLACED,
        at,
        account.id.value,
      );

      await this.deps.sessions.save(currentSession);
      await this.deps.accounts.save(account);

      const issued = await this.deps.sessionIssuer.issue(
        {
          accountId: account.id.value,
          credentialId: credential.id.value,
          membershipId: membership.id.value,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        },
        at,
      );

      return { reused: false, account, issued };
    });

    if (refreshed.reused) {
      this.deps.logger.warn(IdentitySecurityLogEvent.RefreshTokenReused, {
        accountId: refreshed.session.accountId.value,
        sessionId: refreshed.session.id.value,
        revokedSessions: refreshed.revokedSessions,
      });
      throw new AppError(IdentityError.RefreshTokenReused);
    }

    return {
      account: toOutputAccount(refreshed.account),
      accessToken: refreshed.issued.accessToken,
      refreshToken: refreshed.issued.refreshToken,
    };
  }
}
