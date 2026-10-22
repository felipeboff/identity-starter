import type { ErrorDefinition } from "../../domain/errors/app-error";
import type { InputInvalidData } from "../../domain/errors/input-invalid-data";

export type BuiltInViolationReason =
  | "required"
  | "unexpected"
  | "invalid_type"
  | "invalid_string"
  | "invalid_number"
  | "invalid_integer"
  | "invalid_bigint"
  | "invalid_boolean"
  | "invalid_date"
  | "invalid_email"
  | "invalid_uuid"
  | "invalid_object_id"
  | "invalid_cpf"
  | "invalid_cnpj"
  | "invalid_cpf_cnpj"
  | "invalid_enum"
  | "invalid_array"
  | "invalid_object"
  | "min"
  | "max"
  | "min_length"
  | "max_length";

export type ViolationReason = BuiltInViolationReason | (string & {});

export type Violation = {
  field: string;
  reason: ViolationReason;
};

export type ParseSuccess<T> = {
  ok: true;
  data: T;
};

export type ParseFailure = {
  ok: false;
  violations: Violation[];
};

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export type Schema<T = unknown> = {
  parse(input: unknown): ParseResult<T>;
  /** Like `parse`, but returns the data or throws `error` (default `SharedError.InputInvalid`). */
  probe(input: unknown, error?: ErrorDefinition<InputInvalidData>): T;
};

export type Shape<T> = { [K in keyof T]-?: Schema<T[K]> };

export type Transform<T> = (value: T) => T;

export type Refine<T> = {
  check: (value: T) => boolean;
  reason: ViolationReason;
  field?: string;
};

export type BaseOptions<T> = {
  optional?: boolean;
  nullable?: boolean;
  default?: T;
  transform?: Transform<T>;
  refine?: Refine<T>[];
};
