import type { StaticDecode, TSchema } from "typebox";
import type { TLocalizedValidationError } from "typebox/error";
import Value from "typebox/value";

import { AppError, type ErrorDefinition } from "../domain/errors/app-error";
import type {
  InputInvalidData,
  InputViolation,
} from "../domain/errors/input-invalid-data";
import { SharedError } from "../domain/errors/shared.error";

export type SchemaParseResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; violations: readonly InputViolation[] }>;

export class SchemaParser {
  safeParse<S extends TSchema>(
    schema: S,
    raw: unknown,
  ): SchemaParseResult<StaticDecode<S>> {
    const value = Value.Clean(
      schema,
      Value.Convert(schema, Value.Default(schema, Value.Clone(raw))),
    );
    const errors = Value.Errors(schema, value);
    if (errors.length > 0) {
      return { ok: false, violations: this.violationsOf(errors) };
    }
    return { ok: true, data: Value.Decode(schema, value) };
  }

  parse<S extends TSchema>(
    schema: S,
    raw: unknown,
    error: ErrorDefinition<InputInvalidData> = SharedError.InputInvalid,
  ): StaticDecode<S> {
    const parsed = this.safeParse(schema, raw);
    if (!parsed.ok)
      throw new AppError(error, { violations: parsed.violations });
    return parsed.data;
  }

  private violationsOf(
    errors: readonly TLocalizedValidationError[],
  ): InputViolation[] {
    const violations = errors.flatMap((error): InputViolation[] =>
      error.keyword === "required"
        ? error.params.requiredProperties.map((property) => ({
            field: this.fieldOf([
              ...this.segmentsOf(error.instancePath),
              property,
            ]),
            reason: "required",
          }))
        : [
            {
              field: this.fieldOf(this.segmentsOf(error.instancePath)),
              reason: error.keyword,
            },
          ],
    );
    const seen = new Set<string>();
    return violations.filter((violation) => {
      const key = JSON.stringify([violation.field, violation.reason]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private segmentsOf(pointer: string): string[] {
    return pointer
      .split("/")
      .slice(1)
      .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  }

  private fieldOf(segments: readonly string[]): string {
    return segments.join(".");
  }
}
