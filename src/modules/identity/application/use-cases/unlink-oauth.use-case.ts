import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import { UnlinkOAuthDeps, UnlinkOAuthInput } from "./unlink-oauth.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";
import { OAuthProvider } from "@/identity/domain/value-objects/oauth-provider.value-object";

/** Removes a provider identity; the account must keep another way to sign in. */
export class UnlinkOAuthUseCase extends UseCase<{
  input: UnlinkOAuthInput;
  deps: UnlinkOAuthDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  async execute(input: UnlinkOAuthInput, actor: Actor): Promise<void> {
    const provider = OAuthProvider.create(input.provider).value;

    const account = await this.deps.accountResolver.resolveActive(
      actor.accountId,
    );

    const active = (
      await this.deps.credentials.listByAccountId(account.id.value)
    ).filter((credential) => !credential.isDeleted());

    const credential = active.find((c) => c.provider === provider);
    if (!credential) {
      throw new AppError(IdentityError.CredentialNotFound, {
        accountId: account.id.value,
      });
    }
    if (active.length === 1) {
      throw new AppError(IdentityError.LastCredentialCannotBeRemoved, {
        accountId: account.id.value,
      });
    }

    const at = this.deps.clock.now();
    credential.markAsDeleted(at);
    await this.deps.credentials.save(credential);

    await this.deps.sessionRevoker.revokeActive(account.id.value, {
      reason: SessionRevocationReason.SECURITY,
      at,
      revokedBy: account.id.value,
      where: (session) => session.credentialId.equals(credential.id),
    });
  }
}
