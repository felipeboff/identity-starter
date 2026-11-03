import { defineLogEvent } from "@shared/application/logging/log-event";

export type EmailDeliveryFailure = "timeout" | "network" | "unexpected_status";

export const NotificationsLogEvent = {
  EmailLogged: defineLogEvent<{
    template: string;
    to: string;
    link: string | null;
    expiresAt: string | null;
  }>("notifications.email_logged"),
  EmailDeliveryFailed: defineLogEvent<{
    template: string;
    failure: EmailDeliveryFailure;
    status?: number;
  }>("notifications.email_delivery_failed"),
};
