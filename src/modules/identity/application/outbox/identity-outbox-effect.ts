export const IdentityOutboxEffect = {
  PASSWORD_RESET_EMAIL: "identity.password_reset_email",
  EMAIL_VERIFICATION_EMAIL: "identity.email_verification_email",
} as const;

export type IdentityOutboxEffect =
  (typeof IdentityOutboxEffect)[keyof typeof IdentityOutboxEffect];
