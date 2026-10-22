import { defineError } from "@shared/domain/errors/app-error";

export const IdentityError = {
  Generic: defineError("identity.generic", "not_found"),
  SessionNotFound: defineError<{ sessionId: string }>(
    "identity.session_not_found",
    "not_found",
  ),
  SessionRevoked: defineError<{ sessionId: string }>(
    "identity.session_revoked",
    "precondition_failed",
  ),
  SessionExpired: defineError<{ sessionId: string }>(
    "identity.session_expired",
    "precondition_failed",
  ),
  InvalidRefreshToken: defineError(
    "identity.invalid_refresh_token",
    "unauthenticated",
  ),
  InvalidCredentials: defineError<{ email: string }>(
    "identity.invalid_credentials",
    "unauthenticated",
  ),
  AccountEmailTaken: defineError<{ email: string }>(
    "identity.account_email_taken",
    "invalid_input",
  ),
  AccountNotFound: defineError<{ email: string } | { accountId: string }>(
    "identity.account_not_found",
    "not_found",
  ),
  CredentialNotFound: defineError<
    { email: string } | { credentialId: string } | { accountId: string }
  >("identity.credential_not_found", "not_found"),
  MembershipNotFound: defineError<{ accountId: string }>(
    "identity.membership_not_found",
    "not_found",
  ),
  AccountDeleted: defineError<{ accountId: string }>(
    "identity.account_deleted",
    "precondition_failed",
  ),
  MembershipDeleted: defineError<{ membershipId: string }>(
    "identity.membership_deleted",
    "precondition_failed",
  ),
  CredentialEmailTaken: defineError<{ email: string }>(
    "identity.credential_email_taken",
    "invalid_input",
  ),
  CredentialDeleted: defineError<{ credentialId: string }>(
    "identity.credential_deleted",
    "precondition_failed",
  ),
  CredentialAccountMismatch: defineError<{
    accountId: string;
    credentialAccountId: string;
  }>("identity.credential_account_mismatch", "conflict"),
  CredentialPasswordNotSet: defineError<{ credentialId: string }>(
    "identity.credential_password_not_set",
    "precondition_failed",
  ),
  PasswordHashNotAllowedForProvider: defineError<{ provider: string }>(
    "identity.password_hash_not_allowed_for_provider",
    "invalid_input",
  ),
  ProviderEmailRequiredForEmail: defineError(
    "identity.provider_email_required_for_email",
    "invalid_input",
  ),
  SubjectDoesNotMatchProviderEmail: defineError<{
    subject: string;
    providerEmail: string;
  }>("identity.subject_does_not_match_provider_email", "invalid_input"),
  InvalidSessionRevocationReason: defineError<{ reason: string }>(
    "identity.invalid_session_revocation_reason",
    "invalid_input",
  ),
  InvalidMembershipRole: defineError<{ role: string }>(
    "identity.invalid_membership_role",
    "invalid_input",
  ),
  InvalidMembershipPermissions: defineError<{ permissions: string[] }>(
    "identity.invalid_membership_permissions",
    "invalid_input",
  ),
  PasswordHashRequired: defineError<{ passwordHash: string }>(
    "identity.password_hash_required",
    "invalid_input",
  ),
  PasswordHashInvalid: defineError<{ passwordHash: string }>(
    "identity.password_hash_invalid",
    "invalid_input",
  ),
  TokenHashRequired: defineError<{ tokenHash: string }>(
    "identity.token_hash_required",
    "invalid_input",
  ),
  InvitationAlreadyAccepted: defineError(
    "identity.invitation_already_accepted",
    "precondition_failed",
  ),
  InvitationRevoked: defineError(
    "identity.invitation_revoked",
    "precondition_failed",
  ),
  InvitationExpired: defineError(
    "identity.invitation_expired",
    "precondition_failed",
  ),
  PasswordResetExpired: defineError(
    "identity.password_reset_expired",
    "precondition_failed",
  ),
  PasswordResetDeleted: defineError(
    "identity.password_reset_deleted",
    "precondition_failed",
  ),
  PasswordResetAlreadyConsumed: defineError(
    "identity.password_reset_already_consumed",
    "precondition_failed",
  ),
  InvalidPasswordResetToken: defineError(
    "identity.invalid_password_reset_token",
    "unauthenticated",
  ),
  EmailVerificationExpired: defineError(
    "identity.email_verification_expired",
    "precondition_failed",
  ),
  EmailVerificationDeleted: defineError(
    "identity.email_verification_deleted",
    "precondition_failed",
  ),
  EmailVerificationAlreadyConsumed: defineError(
    "identity.email_verification_already_consumed",
    "precondition_failed",
  ),
  InvalidEmailVerificationToken: defineError(
    "identity.invalid_email_verification_token",
    "unauthenticated",
  ),
  AccountEmailAlreadyVerified: defineError<{ accountId: string }>(
    "identity.account_email_already_verified",
    "conflict",
  ),
  Forbidden: defineError<{ actorAccountId: string }>(
    "identity.forbidden",
    "forbidden",
  ),
  OAuthProviderNotSupported: defineError<{ provider: string }>(
    "identity.oauth_provider_not_supported",
    "invalid_input",
  ),
  OAuthProviderAlreadyLinked: defineError<{
    accountId: string;
    provider: string;
  }>("identity.oauth_provider_already_linked", "conflict"),
  OAuthLinkedToAnotherAccount: defineError<{ provider: string }>(
    "identity.oauth_linked_to_another_account",
    "conflict",
  ),
  LastCredentialCannotBeRemoved: defineError<{ accountId: string }>(
    "identity.last_credential_cannot_be_removed",
    "precondition_failed",
  ),
};
