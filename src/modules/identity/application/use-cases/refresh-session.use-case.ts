import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { toOutputAccount } from "../mappers/toOutputAccount";

import {
  RefreshSessionDeps,
  RefreshSessionInput,
  RefreshSessionOutput,
} from "./refresh-session.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

export class RefreshSessionUseCase extends UseCase<{
  input: RefreshSessionInput;
  output: RefreshSessionOutput;
  deps: RefreshSessionDeps;
}> {
  async execute(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    return this.deps.transactions.run(async () => {
      const at = this.deps.clock.now();
      const currentSession = await this.deps.sessions.findByTokenHash(
        this.deps.tokens.hash(input.refreshToken),
      );
      if (!currentSession) {
        throw new AppError(IdentityError.InvalidRefreshToken);
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

      const { accessToken, refreshToken } = await this.deps.sessionIssuer.issue(
        {
          accountId: account.id.value,
          credentialId: credential.id.value,
          membershipId: membership.id.value,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        },
        at,
      );

      return {
        account: toOutputAccount(account),
        accessToken,
        refreshToken,
      };
    });
  }
}
