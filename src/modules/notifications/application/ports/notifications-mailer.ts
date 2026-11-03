export type WelcomeEmail = {
  to: string;
  name: string;
};

export type EmailChangedNotice = {
  to: string;
  name: string;
  newEmail: string;
};

export type NotificationsMailer = {
  sendWelcome(email: WelcomeEmail): Promise<void>;
  sendEmailChanged(notice: EmailChangedNotice): Promise<void>;
};
