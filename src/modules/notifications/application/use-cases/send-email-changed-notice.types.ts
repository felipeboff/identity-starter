import {
  EmailChangedNotice,
  NotificationsMailer,
} from "../ports/notifications-mailer";

export type SendEmailChangedNoticeInput = EmailChangedNotice;

export type SendEmailChangedNoticeDeps = {
  mailer: NotificationsMailer;
};
