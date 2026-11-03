export const NotificationsOutboxEffect = {
  WELCOME_EMAIL: "notifications.welcome_email",
  EMAIL_CHANGED_NOTICE: "notifications.email_changed_notice",
} as const;

export type NotificationsOutboxEffect =
  (typeof NotificationsOutboxEffect)[keyof typeof NotificationsOutboxEffect];
