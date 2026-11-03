import { Invitation } from "@/identity/domain/invitation.entity";
import { MembershipRole } from "@/identity/domain/membership.entity";

export type InvitationOutput = {
  id: string;
  email: string;
  role: MembershipRole;
  permissions: string[];
  createdAt: Date;
  expiresAt: Date;
};

export const toOutputInvitation = (
  invitation: Invitation,
): InvitationOutput => ({
  id: invitation.id.value,
  email: invitation.email.value,
  role: invitation.role,
  permissions: invitation.permissions,
  createdAt: invitation.createdAt,
  expiresAt: invitation.expiresAt,
});
