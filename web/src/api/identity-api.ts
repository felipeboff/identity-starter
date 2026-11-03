import type { ApiClient } from "./api-client";
import type {
  AcceptInvitationInput,
  AccountOutput,
  AuthResult,
  ChangePasswordInput,
  CredentialOutput,
  CredentialsOutput,
  EmailInput,
  InvitationOutput,
  InvitationsOutput,
  InviteMemberInput,
  ListMembersInput,
  Me,
  MembersOutput,
  MembershipOutput,
  OAuthCodeInput,
  PermissionsOutput,
  OAuthProvider,
  OAuthSignInResult,
  RequestEmailChangeInput,
  ResetPasswordInput,
  RevokedCountOutput,
  SessionsOutput,
  SignInInput,
  SignUpInput,
  TokenInput,
  UpdateMemberPermissionsInput,
  UpdateMemberRoleInput,
  UpdateNameInput,
} from "./identity.types";

export class IdentityApi {
  constructor(private readonly client: ApiClient) {}

  signUp(input: SignUpInput): Promise<AuthResult> {
    return this.client.send({
      method: "POST",
      path: "/auth/sign-up",
      body: input,
    });
  }

  signIn(input: SignInInput): Promise<AuthResult> {
    return this.client.send({
      method: "POST",
      path: "/auth/sign-in",
      body: input,
    });
  }

  signInWithOAuth(input: OAuthCodeInput): Promise<OAuthSignInResult> {
    return this.client.send({
      method: "POST",
      path: `/auth/oauth/${this.segment(input.provider)}`,
      body: { code: input.code, codeVerifier: input.codeVerifier },
    });
  }

  requestPasswordReset(input: EmailInput): Promise<void> {
    return this.client.send({
      method: "POST",
      path: "/auth/password-reset/request",
      body: input,
    });
  }

  resetPassword(input: ResetPasswordInput): Promise<void> {
    return this.client.send({
      method: "POST",
      path: "/auth/password-reset",
      body: input,
    });
  }

  verifyEmail(input: TokenInput): Promise<AccountOutput> {
    return this.client.send({
      method: "POST",
      path: "/auth/email-verification",
      body: input,
    });
  }

  acceptInvitation(input: AcceptInvitationInput): Promise<AuthResult> {
    return this.client.send({
      method: "POST",
      path: "/auth/invitations/accept",
      body: input,
    });
  }

  confirmEmailChange(input: TokenInput): Promise<AccountOutput> {
    return this.client.send({
      method: "POST",
      path: "/auth/email-change",
      body: input,
    });
  }

  signOut(): Promise<void> {
    return this.client.send({
      method: "POST",
      path: "/auth/sign-out",
      authenticated: true,
    });
  }

  getMe(): Promise<Me> {
    return this.client.send({
      method: "GET",
      path: "/me",
      authenticated: true,
    });
  }

  updateName(input: UpdateNameInput): Promise<AccountOutput> {
    return this.client.send({
      method: "PATCH",
      path: "/me",
      body: input,
      authenticated: true,
    });
  }

  changePassword(input: ChangePasswordInput): Promise<void> {
    return this.client.send({
      method: "PUT",
      path: "/me/password",
      body: input,
      authenticated: true,
    });
  }

  requestEmailChange(input: RequestEmailChangeInput): Promise<void> {
    return this.client.send({
      method: "POST",
      path: "/me/email",
      body: input,
      authenticated: true,
    });
  }

  requestEmailVerification(): Promise<void> {
    return this.client.send({
      method: "POST",
      path: "/me/email-verification",
      authenticated: true,
    });
  }

  listSessions(): Promise<SessionsOutput> {
    return this.client.send({
      method: "GET",
      path: "/me/sessions",
      authenticated: true,
    });
  }

  revokeOtherSessions(): Promise<RevokedCountOutput> {
    return this.client.send({
      method: "DELETE",
      path: "/me/sessions",
      authenticated: true,
    });
  }

  listCredentials(): Promise<CredentialsOutput> {
    return this.client.send({
      method: "GET",
      path: "/me/credentials",
      authenticated: true,
    });
  }

  linkOAuth(input: OAuthCodeInput): Promise<CredentialOutput> {
    return this.client.send({
      method: "POST",
      path: `/me/oauth/${this.segment(input.provider)}`,
      body: { code: input.code, codeVerifier: input.codeVerifier },
      authenticated: true,
    });
  }

  unlinkOAuth(provider: OAuthProvider): Promise<void> {
    return this.client.send({
      method: "DELETE",
      path: `/me/oauth/${this.segment(provider)}`,
      authenticated: true,
    });
  }

  revokeSession(sessionId: string): Promise<void> {
    return this.client.send({
      method: "DELETE",
      path: `/sessions/${this.segment(sessionId)}`,
      authenticated: true,
    });
  }

  listAccountSessions(accountId: string): Promise<SessionsOutput> {
    return this.client.send({
      method: "GET",
      path: `/accounts/${this.segment(accountId)}/sessions`,
      authenticated: true,
    });
  }

  revokeAllSessions(accountId: string): Promise<RevokedCountOutput> {
    return this.client.send({
      method: "DELETE",
      path: `/accounts/${this.segment(accountId)}/sessions`,
      authenticated: true,
    });
  }

  deactivateAccount(accountId: string): Promise<void> {
    return this.client.send({
      method: "POST",
      path: `/accounts/${this.segment(accountId)}/deactivate`,
      authenticated: true,
    });
  }

  reactivateAccount(accountId: string): Promise<AccountOutput> {
    return this.client.send({
      method: "POST",
      path: `/accounts/${this.segment(accountId)}/reactivate`,
      authenticated: true,
    });
  }

  listMembers(input: ListMembersInput): Promise<MembersOutput> {
    const query = new URLSearchParams();
    if (input.cursor) query.set("cursor", input.cursor);
    if (input.limit) query.set("limit", String(input.limit));
    const search = query.size > 0 ? `?${query}` : "";
    return this.client.send({
      method: "GET",
      path: `/members${search}`,
      authenticated: true,
    });
  }

  updateMemberRole(input: UpdateMemberRoleInput): Promise<MembershipOutput> {
    return this.client.send({
      method: "PUT",
      path: `/members/${this.segment(input.accountId)}/role`,
      body: { role: input.role },
      authenticated: true,
    });
  }

  updateMemberPermissions(
    input: UpdateMemberPermissionsInput,
  ): Promise<MembershipOutput> {
    return this.client.send({
      method: "PUT",
      path: `/members/${this.segment(input.accountId)}/permissions`,
      body: { permissions: input.permissions },
      authenticated: true,
    });
  }

  inviteMember(input: InviteMemberInput): Promise<InvitationOutput> {
    return this.client.send({
      method: "POST",
      path: "/invitations",
      body: input,
      authenticated: true,
    });
  }

  listPermissions(): Promise<PermissionsOutput> {
    return this.client.send({
      method: "GET",
      path: "/permissions",
      authenticated: true,
    });
  }

  listInvitations(): Promise<InvitationsOutput> {
    return this.client.send({
      method: "GET",
      path: "/invitations",
      authenticated: true,
    });
  }

  revokeInvitation(invitationId: string): Promise<void> {
    return this.client.send({
      method: "DELETE",
      path: `/invitations/${this.segment(invitationId)}`,
      authenticated: true,
    });
  }

  private segment(value: string): string {
    return encodeURIComponent(value);
  }
}
