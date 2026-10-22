import { OAuthProviderName } from "@/identity/domain/value-objects/oauth-provider.value-object";

export type OAuthProfile = {
  subject: string;
  email: string;
  name: string;
};

export type OAuthGateway = {
  /** Exchanges an authorization code for the provider's view of the user. */
  exchangeCode(
    provider: OAuthProviderName,
    code: string,
  ): Promise<OAuthProfile>;
};
