import type {
  EmailChangedNotice,
  NotificationsMailer,
  WelcomeEmail,
} from "../ports/notifications-mailer";

export class FakeNotificationsMailer implements NotificationsMailer {
  readonly welcomes: WelcomeEmail[] = [];
  readonly emailChangedNotices: EmailChangedNotice[] = [];

  sendWelcome(email: WelcomeEmail): Promise<void> {
    this.welcomes.push(email);
    return Promise.resolve();
  }

  sendEmailChanged(notice: EmailChangedNotice): Promise<void> {
    this.emailChangedNotices.push(notice);
    return Promise.resolve();
  }
}
