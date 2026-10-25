import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import {
  ChangePasswordDeps,
  ChangePasswordInput,
} from "./change-password.types";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

export class ChangePasswordUseCase extends UseCase<{
  input: ChangePasswordInput;
  deps: ChangePasswordDeps;
  actor: Actor;
}> {
  async execute(input: ChangePasswordInput, actor: Actor) {
    const account = await this.deps.accountResolver.resolveActive(
      actor.accountId,
    );

    const credentials = await this.deps.credentials.listByAccountId(
      account.id.value,
    );
    const credential = credentials.find(
      (candidate) => candidate.provider === AuthProvider.EMAIL,
    );
    if (!credential) {
      throw new AppError(IdentityError.CredentialNotFound, {
        accountId: account.id.value,
      });
    }
    if (credential.isDeleted()) {
      throw new AppError(IdentityError.CredentialDeleted, {
        credentialId: credential.id.value,
      });
    }

    if (!credential.passwordHash) {
      throw new AppError(IdentityError.CredentialPasswordNotSet, {
        credentialId: credential.id.value,
      });
    }

    const ok = await this.deps.passwordHasher.verify(
      input.oldPassword,
      credential.passwordHash.value,
    );
    if (!ok) {
      throw new AppError(IdentityError.InvalidCredentials, {
        email: account.email.value,
      });
    }

    const at = this.deps.clock.now();
    const passwordHash = await this.deps.passwordHasher.hash(input.newPassword);

    credential.updatePasswordHash(passwordHash, at);
    return this.deps.transactions.run(async () => {
      await this.deps.credentials.save(credential);

      await this.deps.sessionRevoker.revokeActive(account.id.value, {
        reason: SessionRevocationReason.PASSWORD_CHANGED,
        at,
        revokedBy: account.id.value,
      });
    });
  }
}
