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

type OAuthSignIn = Readonly<{
  account: Account;
  issued: IssuedSession;
  isNewAccount: boolean;
}>;

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

    const profile = await this.deps.oauth.exchangeCode({
      provider,
      code: input.code,
      codeVerifier: input.codeVerifier,
    });
    const signedIn = await this.deps.transactions.run(async () => {
      const at = this.deps.clock.now();

      const credential = await this.deps.credentials.findByProviderAndSubject(
        provider,
        profile.subject,
      );

      return credential
        ? this.signIn(credential, input, at)
        : this.signUp(provider, profile, input, at);
    });

    return {
      account: toOutputAccount(signedIn.account),
      isNewAccount: signedIn.isNewAccount,
      accessToken: signedIn.issued.accessToken,
      refreshToken: signedIn.issued.refreshToken,
    };
  }

  private async signIn(
    credential: Credential,
    device: Device,
    at: Date,
  ): Promise<OAuthSignIn> {
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

    const issued = await this.deps.sessionIssuer.issue(
      {
        accountId: account.id.value,
        credentialId: credential.id.value,
        membershipId: membership.id.value,
        ...device,
      },
      at,
    );

    return { account, issued, isNewAccount: false };
  }

  private async signUp(
    provider: OAuthProviderName,
    profile: OAuthProfile,
    device: Device,
    at: Date,
  ): Promise<OAuthSignIn> {
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
    account.markEmailAsVerified(at);
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

    return { account, issued, isNewAccount: true };
  }
}
