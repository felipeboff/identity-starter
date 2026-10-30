import type { RateLimitRule } from "@shared/application/services/rate-limiter";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const RateLimitPolicy = {
  SIGN_UP_PER_IP: {
    name: "identity:sign-up:ip",
    limit: 10,
    windowMs: HOUR_MS,
  },
  SIGN_IN_PER_IP: {
    name: "identity:sign-in:ip",
    limit: 20,
    windowMs: 15 * MINUTE_MS,
  },
  SIGN_IN_FAILURES_PER_EMAIL: {
    name: "identity:sign-in-failures:email",
    limit: 5,
    windowMs: 15 * MINUTE_MS,
  },
  OAUTH_PER_IP: {
    name: "identity:oauth:ip",
    limit: 20,
    windowMs: 15 * MINUTE_MS,
  },
  REFRESH_PER_IP: {
    name: "identity:refresh:ip",
    limit: 60,
    windowMs: 15 * MINUTE_MS,
  },
  PASSWORD_RESET_REQUEST_PER_IP: {
    name: "identity:password-reset-request:ip",
    limit: 5,
    windowMs: HOUR_MS,
  },
  PASSWORD_RESET_REQUEST_PER_EMAIL: {
    name: "identity:password-reset-request:email",
    limit: 3,
    windowMs: HOUR_MS,
  },
  PASSWORD_RESET_PER_IP: {
    name: "identity:password-reset:ip",
    limit: 10,
    windowMs: HOUR_MS,
  },
  EMAIL_VERIFICATION_PER_IP: {
    name: "identity:email-verification:ip",
    limit: 10,
    windowMs: HOUR_MS,
  },
  EMAIL_VERIFICATION_REQUEST_PER_IP: {
    name: "identity:email-verification-request:ip",
    limit: 5,
    windowMs: HOUR_MS,
  },
  ACCEPT_INVITATION_PER_IP: {
    name: "identity:accept-invitation:ip",
    limit: 10,
    windowMs: HOUR_MS,
  },
  CHANGE_EMAIL_PER_IP: {
    name: "identity:change-email:ip",
    limit: 5,
    windowMs: HOUR_MS,
  },
  CONFIRM_EMAIL_CHANGE_PER_IP: {
    name: "identity:confirm-email-change:ip",
    limit: 10,
    windowMs: HOUR_MS,
  },
  CHANGE_PASSWORD_PER_IP: {
    name: "identity:change-password:ip",
    limit: 10,
    windowMs: HOUR_MS,
  },
} as const satisfies Record<string, RateLimitRule>;
