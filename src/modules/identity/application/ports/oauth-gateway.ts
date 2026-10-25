import { OAuthProviderName } from "@/identity/domain/value-objects/oauth-provider.value-object";

export type OAuthProfile = {
  subject: string;
  email: string;
  name: string;
};

export type OAuthCodeExchange = Readonly<{
  provider: OAuthProviderName;
  code: string;
  codeVerifier?: string;
}>;

export type OAuthGateway = {
  exchangeCode(exchange: OAuthCodeExchange): Promise<OAuthProfile>;
};
