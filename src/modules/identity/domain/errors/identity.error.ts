import { defineError } from "@shared/domain/errors/app-error";

export const IdentityError = {
  AccountDeleted: defineError(
    "identity.account_deleted",
    "precondition_failed",
  ),
  MembershipDeleted: defineError(
    "identity.membership_deleted",
    "precondition_failed",
  ),
  CredentialDeleted: defineError(
    "identity.credential_deleted",
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
};
