import {
  addViolation,
  failure,
  prefixViolations,
  resolveInput,
  result,
  runRefinements,
} from "../internal/helpers";
import type { BaseOptions, Schema, Violation } from "../types";

import { schema } from "./schema";

export type ArrayOptions<T> = BaseOptions<T[]> & {
  minLength?: number;
  maxLength?: number;
  csv?: boolean;
};

const splitCsv = (input: string): string[] =>
  input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const array = <T>(
  itemSchema: Schema<T>,
  options?: ArrayOptions<T>,
): Schema<T[]> =>
  schema((input) => {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;
    const items =
      options?.csv === true && typeof resolved.value === "string"
        ? splitCsv(resolved.value)
        : resolved.value;
    if (!Array.isArray(items)) return failure("invalid_array");

    const data: T[] = [];
    const violations: Violation[] = [];
    if (options?.minLength !== undefined && items.length < options.minLength) {
      addViolation(violations, "min_length");
    }
    if (options?.maxLength !== undefined && items.length > options.maxLength) {
      addViolation(violations, "max_length");
    }
    for (let index = 0; index < items.length; index += 1) {
      const parsed = itemSchema.parse(items[index]);
      if (!parsed.ok) {
        violations.push(...prefixViolations(String(index), parsed.violations));
      } else {
        data.push(parsed.data);
      }
    }
    if (violations.length > 0) return { ok: false, violations };

    let value = data;
    if (options?.transform) value = options.transform(value);
    return result(value, runRefinements(value, options?.refine));
  });
