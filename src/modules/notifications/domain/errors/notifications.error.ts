import { defineError } from "@shared/domain/errors/app-error";

export const NotificationsError = {
  EmailDeliveryFailed: defineError(
    "notifications.email_delivery_failed",
    "precondition_failed",
  ),
};
