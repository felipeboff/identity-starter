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

  AlreadyExists: defineError<{ id: string }>(
    "shared.already_exists",
    "conflict",
  ),
  VersionConflict: defineError<{ id: string; version: number }>(
    "shared.version_conflict",
    "conflict",
  ),

  RouteNotFound: defineError<{ method: string; path: string }>(
    "shared.route_not_found",
    "not_found",
  ),
  BodyMalformed: defineError("shared.body_malformed", "invalid_input"),
  DatabaseUnavailable: defineError(
    "shared.database_unavailable",
    "precondition_failed",
  ),
  InMemoryAdaptersInProduction: defineError(
    "shared.in_memory_adapters_in_production",
    "precondition_failed",
  ),
  DatabaseNotReplicaSet: defineError<{ host: string }>(
    "shared.database_not_replica_set",
    "precondition_failed",
  ),
  NestedTransaction: defineError(
    "shared.nested_transaction",
    "precondition_failed",
  ),
};
