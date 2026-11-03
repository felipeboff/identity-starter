export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const OBJECT_ID_PATTERN = "[a-fA-F0-9]{24}";

export const Permission = {
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

export type Permission = (typeof Permission)[keyof typeof Permission];

export const MEMBER_ACTION_PERMISSIONS: readonly Permission[] = [
  Permission.MEMBER_ROLE_UPDATE,
  Permission.MEMBER_PERMISSIONS_UPDATE,
  Permission.ACCOUNT_DEACTIVATE,
  Permission.ACCOUNT_REACTIVATE,
  Permission.SESSION_READ,
  Permission.SESSION_REVOKE_ALL,
];

export const Role = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: readonly Role[] = Object.values(Role);

export const OAuthProvider = {
  GITHUB: "github",
  GOOGLE: "google",
} as const;

export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];

export const ALL_OAUTH_PROVIDERS: readonly OAuthProvider[] =
  Object.values(OAuthProvider);

export type Account = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  deactivatedAt: string | null;
};

export type Membership = {
  id: string;
  accountId: string;
  role: Role;
  permissions: string[];
  updatedAt: string;
};

export type Session = {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  role: Role;
  permissions: string[];
  createdAt: string;
  expiresAt: string;
};

export type Credential = {
  id: string;
  provider: string;
  providerEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = SessionTokens & {
  account: Account;
};

export type OAuthSignInResult = AuthResult & {
  isNewAccount: boolean;
};

export type Me = {
  account: Account;
  membership: Membership;
};

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type OAuthCodeInput = {
  provider: OAuthProvider;
  code: string;
  codeVerifier: string;
};

export type EmailInput = {
  email: string;
};

export type TokenInput = {
  token: string;
};

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export type AcceptInvitationInput = {
  token: string;
  name: string;
  password: string;
};

export type UpdateNameInput = {
  name: string;
};

export type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
};

export type RequestEmailChangeInput = {
  newEmail: string;
  password: string;
};

export type InviteMemberInput = {
  email: string;
  role: Role;
  permissions: string[];
};

export type UpdateMemberRoleInput = {
  accountId: string;
  role: Role;
};

export type PermissionsOutput = {
  permissions: string[];
};

export type UpdateMemberPermissionsInput = {
  accountId: string;
  permissions: string[];
};

export type AccountOutput = {
  account: Account;
};

export type MembershipOutput = {
  membership: Membership;
};

export type RevokedCountOutput = {
  revokedCount: number;
};

export type SessionsOutput = {
  sessions: Session[];
};

export type InvitationOutput = {
  invitation: Invitation;
};

export type InvitationsOutput = {
  invitations: Invitation[];
};

export type CredentialOutput = {
  credential: Credential;
};

export type CredentialsOutput = {
  credentials: Credential[];
};

export type Member = {
  account: Account;
  membership: Membership;
};

export type ListMembersInput = {
  cursor?: string;
  limit?: number;
};

export type MembersOutput = {
  members: Member[];
  nextCursor: string | null;
};
