import { defineError } from "./app-error";

export const SharedError = {
  EmailRequired: defineError<{ email: string }>(
    "shared.email_required",
    "invalid_input",
  ),
  EmailInvalid: defineError<{ email: string }>(
    "shared.email_invalid",
    "invalid_input",
  ),
  EmailTooLong: defineError<{ maxLength: number; length: number }>(
    "shared.email_too_long",
    "invalid_input",
  ),

  IdRequired: defineError<{ id: string }>(
    "shared.id_required",
    "invalid_input",
  ),
  IdInvalid: defineError<{ id: string }>("shared.id_invalid", "invalid_input"),
};
