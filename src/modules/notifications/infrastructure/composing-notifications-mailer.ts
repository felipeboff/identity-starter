import type { MailSender } from "@shared/application/ports/mail-sender";

import type {
  EmailChangedNotice,
  NotificationsMailer,
  WelcomeEmail,
} from "../application/ports/notifications-mailer";

import type { NotificationsEmailComposer } from "./notifications-email-composer";

export type ComposingNotificationsMailerDeps = Readonly<{
  composer: NotificationsEmailComposer;
  sender: MailSender;
}>;

export class ComposingNotificationsMailer implements NotificationsMailer {
  constructor(private readonly deps: ComposingNotificationsMailerDeps) {}

  sendWelcome(email: WelcomeEmail): Promise<void> {
    return this.deps.sender.send(this.deps.composer.welcome(email));
  }

  sendEmailChanged(notice: EmailChangedNotice): Promise<void> {
    return this.deps.sender.send(this.deps.composer.emailChanged(notice));
  }
}
