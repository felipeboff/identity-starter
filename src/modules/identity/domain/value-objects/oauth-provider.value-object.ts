import { AppError } from "@shared/domain/errors/app-error";

import { AuthProvider } from "../credential.entity";
import { IdentityError } from "../errors/identity.error";

export type OAuthProviderName = Exclude<
  AuthProvider,
  typeof AuthProvider.EMAIL
>;

const OAUTH_PROVIDERS: readonly string[] = Object.values(AuthProvider).filter(
  (provider) => provider !== AuthProvider.EMAIL,
);

/** An auth provider that signs in through OAuth (every provider but e-mail). */
export class OAuthProvider {
  private constructor(private readonly state: OAuthProviderName) {}

  public static create(input: string): OAuthProvider {
    if (!OAUTH_PROVIDERS.includes(input)) {
      throw new AppError(IdentityError.OAuthProviderNotSupported, {
        provider: input,
      });
    }
    return new OAuthProvider(input as OAuthProviderName);
  }

  public get value(): OAuthProviderName {
    return this.state;
  }
}
