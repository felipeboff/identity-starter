import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { toOutputAccount } from "../mappers/toOutputAccount";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import {
  SignInWithEmailDeps,
  SignInWithEmailInput,
  SignInWithEmailOutput,
} from "./sign-in-with-email.types";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

type StoredPassword =
  | Readonly<{ hash: string; account: Account; credential: Credential }>
  | Readonly<{ hash: null; reason: string }>;

export class SignInWithEmailUseCase extends UseCase<{
  input: SignInWithEmailInput;
  output: SignInWithEmailOutput;
  deps: SignInWithEmailDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: SignInWithEmailInput): Promise<SignInWithEmailOutput> {
    try {
      return await this.signIn(input);
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code !== IdentityError.InvalidCredentials.code
      ) {
        this.logFailure(input, error.code);
      }
      throw error;
    }
  }

  private async signIn(
    input: SignInWithEmailInput,
  ): Promise<SignInWithEmailOutput> {
    await this.deps.signInThrottle.ensureAllowed(input.email);

    const stored = await this.findStoredPassword(input.email);
    const matches = await this.deps.passwordHasher.verify(
      input.password,
      stored.hash,
    );
    if (stored.hash === null || !matches) {
      await this.deps.signInThrottle.recordFailure(input.email);
      this.logFailure(
        input,
        stored.hash === null
          ? stored.reason
          : IdentityError.InvalidCredentials.code,
      );
      throw new AppError(IdentityError.InvalidCredentials);
    }
    await this.deps.signInThrottle.reset(input.email);

    const { account, credential } = stored;
    if (account.isDeleted()) {
      throw new AppError(IdentityError.AccountDeleted, {
        accountId: account.id.value,
      });
    }
    if (!credential.accountId.equals(account.id)) {
      throw new AppError(IdentityError.CredentialAccountMismatch, {
        accountId: account.id.value,
        credentialAccountId: credential.accountId.value,
      });
    }

    const membership = await this.deps.memberships.findByAccountId(
      account.id.value,
    );
    if (!membership) {
      throw new AppError(IdentityError.MembershipNotFound, {
        accountId: account.id.value,
      });
    }
    if (membership.isDeleted()) {
      throw new AppError(IdentityError.MembershipDeleted, {
        membershipId: membership.id.value,
      });
    }

    const issued = await this.deps.transactions.run(async () => {
      const at = this.deps.clock.now();
      account.markAsLastSeen(at);

      await this.deps.accounts.save(account);

      return this.deps.sessionIssuer.issue(
        {
          accountId: account.id.value,
          credentialId: credential.id.value,
          membershipId: membership.id.value,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        },
        at,
      );
    });
    this.deps.logger.info(IdentityUseCaseLogEvent.SignedIn, {
      accountId: account.id.value,
      sessionId: issued.session.id.value,
      provider: AuthProvider.EMAIL,
      ipAddress: input.ipAddress,
    });

    return {
      account: toOutputAccount(account),
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    };
  }

  private logFailure(input: SignInWithEmailInput, reason: string): void {
    this.deps.logger.warn(IdentityUseCaseLogEvent.SignInFailed, {
      provider: AuthProvider.EMAIL,
      reason,
      ipAddress: input.ipAddress,
      email: input.email,
    });
  }

  private async findStoredPassword(email: string): Promise<StoredPassword> {
    const account = await this.deps.accounts.findByEmail(email);
    const credential = await this.deps.credentials.findByEmail(email);

    if (!account) {
      return { hash: null, reason: IdentityError.AccountNotFound.code };
    }
    if (!credential) {
      return { hash: null, reason: IdentityError.CredentialNotFound.code };
    }
    if (credential.isDeleted()) {
      return { hash: null, reason: IdentityError.CredentialDeleted.code };
    }
    if (credential.provider !== AuthProvider.EMAIL) {
      return {
        hash: null,
        reason: IdentityError.PasswordHashNotAllowedForProvider.code,
      };
    }
    if (credential.passwordHash == null) {
      return {
        hash: null,
        reason: IdentityError.CredentialPasswordNotSet.code,
      };
    }
    return { hash: credential.passwordHash.value, account, credential };
  }
}
