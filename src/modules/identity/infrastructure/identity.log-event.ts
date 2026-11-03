import { defineLogEvent } from "@shared/application/logging/log-event";

export type ExternalCallFailure =
  "timeout" | "network" | "unexpected_status" | "unexpected_body";

export const IdentityLogEvent = {
  OAuthProviderFailed: defineLogEvent<{
    provider: string;
    step: string;
    failure: ExternalCallFailure;
    status?: number;
    providerError?: string;
  }>("identity.oauth_provider_failed"),
};
