import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";
import { toOutputCredential } from "../mappers/toOutputCredential";

import {
  LinkOAuthDeps,
  LinkOAuthInput,
  LinkOAuthOutput,
} from "./link-oauth.types";

import { Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { OAuthProvider } from "@/identity/domain/value-objects/oauth-provider.value-object";

/** The authenticated account attaches a provider identity to itself. */
export class LinkOAuthUseCase extends UseCase<{
  input: LinkOAuthInput;
  output: LinkOAuthOutput;
  deps: LinkOAuthDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  async execute(input: LinkOAuthInput, actor: Actor): Promise<LinkOAuthOutput> {
    const provider = OAuthProvider.create(input.provider).value;

    const account = await this.deps.accountResolver.resolveActive(
      actor.accountId,
    );
    const profile = await this.deps.oauth.exchangeCode({
      provider,
      code: input.code,
      codeVerifier: input.codeVerifier,
    });
    const at = this.deps.clock.now();

    const existing = await this.deps.credentials.findByProviderAndSubject(
      provider,
      profile.subject,
    );
    if (existing && !existing.accountId.equals(account.id)) {
      throw new AppError(IdentityError.OAuthLinkedToAnotherAccount, {
        provider,
      });
    }
    if (existing && !existing.isDeleted()) {
      return { credential: toOutputCredential(existing) };
    }

    const owned = await this.deps.credentials.listByAccountId(account.id.value);
    if (owned.some((c) => !c.isDeleted() && c.provider === provider)) {
      throw new AppError(IdentityError.OAuthProviderAlreadyLinked, {
        accountId: account.id.value,
        provider,
      });
    }

    const credential =
      existing ??
      Credential.register(
        {
          id: this.deps.ids.next(),
          accountId: account.id.value,
          provider,
          subject: profile.subject,
          providerEmail: profile.email,
        },
        at,
      );
    credential.reactivate(at);
    await this.deps.credentials.save(credential);

    return { credential: toOutputCredential(credential) };
  }
}
