import { defineLogEvent } from "@shared/application/logging/log-event";

export const IdentityUseCaseLogEvent = {
  RefreshTokenReused: defineLogEvent<{
    accountId: string;
    sessionId: string;
    revokedSessions: number;
  }>("identity.refresh_token_reused"),
  VerificationEmailNotSent: defineLogEvent<{
    accountId: string;
    error: unknown;
  }>("identity.verification_email_not_sent"),
  EmailChangedNoticeNotSent: defineLogEvent<{
    accountId: string;
    error: unknown;
  }>("identity.email_changed_notice_not_sent"),
};
