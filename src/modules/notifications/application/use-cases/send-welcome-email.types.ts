import {
  NotificationsMailer,
  WelcomeEmail,
} from "../ports/notifications-mailer";

export type SendWelcomeEmailInput = WelcomeEmail;

export type SendWelcomeEmailDeps = {
  mailer: NotificationsMailer;
};
