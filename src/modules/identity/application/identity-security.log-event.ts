import { defineLogEvent } from "@shared/application/logging/log-event";

export const IdentitySecurityLogEvent = {
  RefreshTokenReused: defineLogEvent<{
    accountId: string;
    sessionId: string;
    revokedSessions: number;
  }>("identity.refresh_token_reused"),
};
