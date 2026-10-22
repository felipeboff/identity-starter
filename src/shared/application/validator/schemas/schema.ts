import { AppError } from "../../../domain/errors/app-error";
import type { ErrorDefinition } from "../../../domain/errors/app-error";
import type { InputInvalidData } from "../../../domain/errors/input-invalid-data";
import { SharedError } from "../../../domain/errors/shared.error";
import type { ParseResult, Schema } from "../types";

/** Builds a schema from its `parse`, adding `probe` on top. */
export const schema = <T>(
  parse: (input: unknown) => ParseResult<T>,
): Schema<T> => ({
  parse,
  probe(
    input: unknown,
    error: ErrorDefinition<InputInvalidData> = SharedError.InputInvalid,
  ): T {
    const parsed = parse(input);
    if (!parsed.ok) {
      throw new AppError(error, { violations: parsed.violations });
    }
    return parsed.data;
  },
});
