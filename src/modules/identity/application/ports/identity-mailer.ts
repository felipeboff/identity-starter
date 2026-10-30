export type TokenEmail = {
  to: string;
  name: string;
  token: string;
  expiresAt: Date;
};

export type InvitationEmail = {
  to: string;
  inviterName: string;
  token: string;
  expiresAt: Date;
};

export type EmailChangedNotice = {
  to: string;
  name: string;
  newEmail: string;
};

export type IdentityMailer = {
  sendPasswordReset(email: TokenEmail): Promise<void>;
  sendEmailVerification(email: TokenEmail): Promise<void>;
  sendInvitation(email: InvitationEmail): Promise<void>;
  sendEmailChange(email: TokenEmail): Promise<void>;
  sendEmailChanged(notice: EmailChangedNotice): Promise<void>;
};
