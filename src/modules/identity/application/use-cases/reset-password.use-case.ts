import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import { ResetPasswordDeps, ResetPasswordInput } from "./reset-password.types";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

/** Consumes the reset token, sets the password (creating the password sign-in when the account has none) and revokes sessions. */
export class ResetPasswordUseCase extends UseCase<{
  input: ResetPasswordInput;
  deps: ResetPasswordDeps;
}> {
  async execute(input: ResetPasswordInput): Promise<void> {
    const at = this.deps.clock.now();

    const passwordReset = await this.deps.passwordResets.findByTokenHash(
      this.deps.tokens.hash(input.token),
    );
    if (!passwordReset) {
      throw new AppError(IdentityError.InvalidPasswordResetToken);
    }
    if (passwordReset.isConsumed()) {
      throw new AppError(IdentityError.PasswordResetAlreadyConsumed);
    }
    passwordReset.consume(at);

    const account = await this.deps.accountResolver.resolveActive(
      passwordReset.accountId.value,
    );

    const passwordHash = await this.deps.passwordHasher.hash(input.newPassword);
    const credential = await this.passwordCredentialOf(
      account,
      passwordHash,
      at,
    );

    await this.deps.transactions.run(async () => {
      await this.deps.credentials.save(credential);
      await this.deps.passwordResets.save(passwordReset);

      await this.deps.sessionRevoker.revokeActive(account.id.value, {
        reason: SessionRevocationReason.PASSWORD_CHANGED,
        at,
      });
    });
    this.deps.logger.info(IdentityUseCaseLogEvent.PasswordReset, {
      accountId: account.id.value,
    });
  }

  private async passwordCredentialOf(
    account: Account,
    passwordHash: string,
    at: Date,
  ): Promise<Credential> {
    const credentials = await this.deps.credentials.listByAccountId(
      account.id.value,
    );
    const existing = credentials.find(
      (credential) => credential.provider === AuthProvider.EMAIL,
    );
    if (existing) {
      existing.updatePasswordHash(passwordHash, at);
      return existing;
    }

    const email = account.email.value;
    return Credential.register(
      {
        id: this.deps.ids.next(),
        accountId: account.id.value,
        provider: AuthProvider.EMAIL,
        subject: email,
        providerEmail: email,
        passwordHash,
      },
      at,
    );
  }
}
