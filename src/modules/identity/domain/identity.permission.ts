export const IdentityPermission = {
  INVITATION_CREATE: "identity.invitation.create",
  INVITATION_READ: "identity.invitation.read",
  INVITATION_REVOKE: "identity.invitation.revoke",
  ACCOUNT_REACTIVATE: "identity.account.reactivate",
  ACCOUNT_DEACTIVATE: "identity.account.deactivate",
  SESSION_READ: "identity.session.read",
  SESSION_REVOKE: "identity.session.revoke",
  SESSION_REVOKE_ALL: "identity.session.revoke_all",
  MEMBER_READ: "identity.member.read",
  MEMBER_ROLE_UPDATE: "identity.member.role.update",
  MEMBER_PERMISSIONS_UPDATE: "identity.member.permissions.update",
} as const;

export type IdentityPermission =
  (typeof IdentityPermission)[keyof typeof IdentityPermission];
