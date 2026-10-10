import { addViolation, failure, resolveInput, result, runRefinements } from '../internal/helpers';
import { NUMBER_PATTERN } from '../internal/patterns';
import type { BaseOptions, Schema, Violation } from '../types';

export type NumberOptions = BaseOptions<number> & {
  integer?: boolean;
  min?: number;
  max?: number;
};

const coerceNumber = (input: unknown): number | undefined => {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const normalized = input.trim();
    if (normalized && NUMBER_PATTERN.test(normalized)) {
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  if (typeof input === 'bigint') {
    const parsed = Number(input);
    if (Number.isSafeInteger(parsed) && BigInt(parsed) === input) return parsed;
  }
  return undefined;
};

export const number = (options?: NumberOptions): Schema<number> => ({
  parse(input) {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;

    let value = coerceNumber(resolved.value);
    if (value === undefined) return failure('invalid_number');
    if (options?.transform) value = options.transform(value);

    const violations: Violation[] = [];
    if (options?.integer === true && !Number.isInteger(value)) addViolation(violations, 'invalid_integer');
    if (options?.min !== undefined && value < options.min) addViolation(violations, 'min');
    if (options?.max !== undefined && value > options.max) addViolation(violations, 'max');
    violations.push(...runRefinements(value, options?.refine));
    return result(value, violations);
  },
});
