import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { toOutputAccount } from "../mappers/toOutputAccount";

import {
  SignInWithEmailDeps,
  SignInWithEmailInput,
  SignInWithEmailOutput,
} from "./sign-in-with-email.types";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

export class SignInWithEmailUseCase extends UseCase<{
  input: SignInWithEmailInput;
  output: SignInWithEmailOutput;
  deps: SignInWithEmailDeps;
}> {
  async execute(input: SignInWithEmailInput): Promise<SignInWithEmailOutput> {
    await this.deps.signInThrottle.ensureAllowed(input.email);

    const account = await this.deps.accounts.findByEmail(input.email);
    if (!account) {
      throw new AppError(IdentityError.AccountNotFound, {
        email: input.email,
      });
    }
    if (account.isDeleted()) {
      throw new AppError(IdentityError.AccountDeleted, {
        accountId: account.id.value,
      });
    }

    const credential = await this.deps.credentials.findByEmail(input.email);
    if (!credential) {
      throw new AppError(IdentityError.CredentialNotFound, {
        email: input.email,
      });
    }
    if (credential.isDeleted()) {
      throw new AppError(IdentityError.CredentialDeleted, {
        credentialId: credential.id.value,
      });
    }
    if (!credential.accountId.equals(account.id)) {
      throw new AppError(IdentityError.CredentialAccountMismatch, {
        accountId: account.id.value,
        credentialAccountId: credential.accountId.value,
      });
    }
    if (credential.provider !== AuthProvider.EMAIL) {
      throw new AppError(IdentityError.PasswordHashNotAllowedForProvider, {
        provider: credential.provider,
      });
    }

    const passwordHash = credential.passwordHash;
    if (passwordHash == null) {
      throw new AppError(IdentityError.CredentialPasswordNotSet, {
        credentialId: credential.id.value,
      });
    }

    const ok = await this.deps.passwordHasher.verify(
      input.password,
      passwordHash.value,
    );
    if (!ok) {
      await this.deps.signInThrottle.recordFailure(input.email);
      throw new AppError(IdentityError.InvalidCredentials, {
        email: input.email,
      });
    }
    await this.deps.signInThrottle.reset(input.email);

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

    return {
      account: toOutputAccount(account),
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    };
  }
}
