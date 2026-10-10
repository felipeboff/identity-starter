import { addViolation, failure, prefixViolations, resolveInput, result, runRefinements } from '../internal/helpers';
import type { BaseOptions, Schema, Violation } from '../types';

export type ArrayOptions<T> = BaseOptions<T[]> & {
  minLength?: number;
  maxLength?: number;
};

export const array = <T>(itemSchema: Schema<T>, options?: ArrayOptions<T>): Schema<T[]> => ({
  parse(input) {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;
    if (!Array.isArray(resolved.value)) return failure('invalid_array');

    const data: T[] = [];
    const violations: Violation[] = [];
    if (options?.minLength !== undefined && resolved.value.length < options.minLength) {
      addViolation(violations, 'min_length');
    }
    if (options?.maxLength !== undefined && resolved.value.length > options.maxLength) {
      addViolation(violations, 'max_length');
    }
    for (let index = 0; index < resolved.value.length; index += 1) {
      const parsed = itemSchema.parse(resolved.value[index]);
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
  },
});
