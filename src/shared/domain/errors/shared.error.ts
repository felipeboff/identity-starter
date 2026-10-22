import { defineError } from "./app-error";
import type { InputInvalidData } from "./input-invalid-data";

export const SharedError = {
  /** Input refused by a `v` schema; `data.violations` names the fields. */
  InputInvalid: defineError<InputInvalidData>(
    "shared.input_invalid",
    "invalid_input",
  ),

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
