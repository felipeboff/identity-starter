import { ApiClient } from "./api/api-client";
import { IdentityApi } from "./api/identity-api";
import { OAuthFlow } from "./auth/oauth-flow";
import { TokenStore } from "./auth/token-store";
import { ErrorMessages } from "./i18n/error-messages";
import { Formatter } from "./i18n/formatter";

export const tokenStore = new TokenStore(window.localStorage);
export const apiClient = new ApiClient({ baseUrl: "/api", tokens: tokenStore });
export const identityApi = new IdentityApi(apiClient);
export const oauthFlow = new OAuthFlow(window.sessionStorage);
export const errorMessages = new ErrorMessages();
export const format = new Formatter();
