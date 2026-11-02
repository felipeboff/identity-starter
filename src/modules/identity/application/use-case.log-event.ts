import { defineLogEvent } from "@shared/application/logging/log-event";

import { SessionRevocationReason } from "@/identity/domain/session.entity";

export const IdentityUseCaseLogEvent = {
  SignedIn: defineLogEvent<{
    accountId: string;
    sessionId: string;
    provider: string;
    ipAddress: string;
  }>("identity.signed_in"),
  SignInFailed: defineLogEvent<{
    provider: string;
    reason: string;
    ipAddress: string;
    email?: string;
  }>("identity.sign_in_failed"),
  PasswordChanged: defineLogEvent<{ accountId: string }>(
    "identity.password_changed",
  ),
  PasswordReset: defineLogEvent<{ accountId: string }>(
    "identity.password_reset",
  ),
  SessionsRevoked: defineLogEvent<{
    accountId: string;
    reason: SessionRevocationReason;
    revokedBy: string | null;
    sessionIds: string[];
  }>("identity.sessions_revoked"),
  RefreshTokenReused: defineLogEvent<{
    accountId: string;
    sessionId: string;
    revokedSessions: number;
  }>("identity.refresh_token_reused"),
  EmailExpiredBeforeDelivery: defineLogEvent<{ type: string }>(
    "identity.email_expired_before_delivery",
  ),
  EmailChangedNoticeNotSent: defineLogEvent<{
    accountId: string;
    error: unknown;
  }>("identity.email_changed_notice_not_sent"),
  AdminGranted: defineLogEvent<{ accountId: string; membershipId: string }>(
    "identity.admin_granted",
  ),
  AdminGrantFailed: defineLogEvent<{ email: string; reason: string }>(
    "identity.admin_grant_failed",
  ),
};
