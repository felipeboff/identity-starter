import { defineLogEvent } from "@shared/application/logging/log-event";

export type ExternalCallFailure =
  "timeout" | "network" | "unexpected_status" | "unexpected_body";

export const IdentityLogEvent = {
  EmailLogged: defineLogEvent<{
    template: string;
    to: string;
    link: string;
    expiresAt: string;
  }>("identity.email_logged"),
  EmailDeliveryFailed: defineLogEvent<{
    template: string;
    failure: ExternalCallFailure;
    status?: number;
  }>("identity.email_delivery_failed"),
  OAuthProviderFailed: defineLogEvent<{
    provider: string;
    step: string;
    failure: ExternalCallFailure;
    status?: number;
    providerError?: string;
  }>("identity.oauth_provider_failed"),
};
