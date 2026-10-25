import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { ResetPasswordDeps, ResetPasswordInput } from "./reset-password.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

/** Consumes the reset token, swaps the password hash and revokes sessions. */
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

    const credential = await this.deps.credentials.findById(
      passwordReset.credentialId.value,
    );
    if (!credential) {
      throw new AppError(IdentityError.CredentialNotFound, {
        credentialId: passwordReset.credentialId.value,
      });
    }

    const passwordHash = await this.deps.passwordHasher.hash(input.newPassword);
    credential.updatePasswordHash(passwordHash, at);

    return this.deps.transactions.run(async () => {
      await this.deps.credentials.save(credential);
      await this.deps.passwordResets.save(passwordReset);

      await this.deps.sessionRevoker.revokeActive(account.id.value, {
        reason: SessionRevocationReason.PASSWORD_CHANGED,
        at,
      });
    });
  }
}
