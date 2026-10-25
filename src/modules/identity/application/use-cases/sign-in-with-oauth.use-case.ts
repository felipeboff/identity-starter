import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { toOutputAccount } from "../mappers/toOutputAccount";
import { OAuthProfile } from "../ports/oauth-gateway";
import { IssuedSession } from "../services/session-issuer";

import {
  Device,
  SignInWithOAuthDeps,
  SignInWithOAuthInput,
  SignInWithOAuthOutput,
} from "./sign-in-with-oauth.types";

import { Account } from "@/identity/domain/account.entity";
import { Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  Membership,
  MembershipRole,
} from "@/identity/domain/membership.entity";
import {
  OAuthProvider,
  OAuthProviderName,
} from "@/identity/domain/value-objects/oauth-provider.value-object";

/**
 * Signing in and signing up are the same gesture: a known `provider + subject`
 * opens a session, an unknown one creates the account first.
 */
export class SignInWithOAuthUseCase extends UseCase<{
  input: SignInWithOAuthInput;
  output: SignInWithOAuthOutput;
  deps: SignInWithOAuthDeps;
}> {
  async execute(input: SignInWithOAuthInput): Promise<SignInWithOAuthOutput> {
    const provider = OAuthProvider.create(input.provider).value;

    const profile = await this.deps.oauth.exchangeCode(provider, input.code);
    return this.deps.transactions.run(async () => {
      const at = this.deps.clock.now();

      const credential = await this.deps.credentials.findByProviderAndSubject(
        provider,
        profile.subject,
      );

      return credential
        ? this.signIn(credential, input, at)
        : this.signUp(provider, profile, input, at);
    });
  }

  private async signIn(
    credential: Credential,
    device: Device,
    at: Date,
  ): Promise<SignInWithOAuthOutput> {
    if (credential.isDeleted()) {
      throw new AppError(IdentityError.CredentialDeleted, {
        credentialId: credential.id.value,
      });
    }

    const account = await this.deps.accountResolver.resolveActive(
      credential.accountId.value,
    );
    const membership = await this.deps.membershipResolver.resolveActive(
      account.id.value,
    );

    account.markAsLastSeen(at);
    await this.deps.accounts.save(account);

    const issued = await this.deps.sessionIssuer.replace(
      {
        accountId: account.id.value,
        credentialId: credential.id.value,
        membershipId: membership.id.value,
        ...device,
      },
      at,
    );

    return this.output(account, issued, false);
  }

  private async signUp(
    provider: OAuthProviderName,
    profile: OAuthProfile,
    device: Device,
    at: Date,
  ): Promise<SignInWithOAuthOutput> {
    // Linking to an existing e-mail must be an explicit, authenticated LinkOAuth.
    const existingAccount = await this.deps.accounts.findByEmail(profile.email);
    if (existingAccount) {
      throw new AppError(IdentityError.AccountEmailTaken, {
        email: profile.email,
      });
    }

    const accountId = this.deps.ids.next();

    const account = Account.register(
      {
        id: accountId,
        name: profile.name,
        email: profile.email,
        createdBy: accountId,
      },
      at,
    );
    const credential = Credential.register(
      {
        id: this.deps.ids.next(),
        accountId,
        provider,
        subject: profile.subject,
        providerEmail: profile.email,
      },
      at,
    );
    const membership = Membership.register(
      {
        id: this.deps.ids.next(),
        accountId,
        createdBy: accountId,
        role: MembershipRole.USER,
        permissions: [],
      },
      at,
    );

    await this.deps.accounts.save(account);
    await this.deps.credentials.save(credential);
    await this.deps.memberships.save(membership);

    const issued = await this.deps.sessionIssuer.issue(
      {
        accountId,
        credentialId: credential.id.value,
        membershipId: membership.id.value,
        ...device,
      },
      at,
    );

    return this.output(account, issued, true);
  }

  private output(
    account: Account,
    issued: IssuedSession,
    isNewAccount: boolean,
  ): SignInWithOAuthOutput {
    return {
      account: toOutputAccount(account),
      isNewAccount,
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    };
  }
}
