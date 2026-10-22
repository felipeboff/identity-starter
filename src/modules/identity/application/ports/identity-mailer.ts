export type TokenEmail = {
  to: string;
  name: string;
  token: string;
  expiresAt: Date;
};

export type IdentityMailer = {
  sendPasswordReset(email: TokenEmail): Promise<void>;
  sendEmailVerification(email: TokenEmail): Promise<void>;
};
