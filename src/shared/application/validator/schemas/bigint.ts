import { addViolation, failure, resolveInput, result, runRefinements } from '../internal/helpers';
import { INTEGER_PATTERN } from '../internal/patterns';
import type { BaseOptions, Schema, Violation } from '../types';

export type BigIntOptions = BaseOptions<bigint> & {
  min?: bigint;
  max?: bigint;
};

const coerceBigInt = (input: unknown): bigint | undefined => {
  if (typeof input === 'bigint') return input;
  if (typeof input === 'number' && Number.isSafeInteger(input)) return BigInt(input);
  if (typeof input === 'string') {
    const normalized = input.trim();
    if (INTEGER_PATTERN.test(normalized)) return BigInt(normalized);
  }
  return undefined;
};

export const bigint = (options?: BigIntOptions): Schema<bigint> => ({
  parse(input) {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;

    let value = coerceBigInt(resolved.value);
    if (value === undefined) return failure('invalid_bigint');
    if (options?.transform) value = options.transform(value);

    const violations: Violation[] = [];
    if (options?.min !== undefined && value < options.min) addViolation(violations, 'min');
    if (options?.max !== undefined && value > options.max) addViolation(violations, 'max');
    violations.push(...runRefinements(value, options?.refine));
    return result(value, violations);
  },
});
